import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
  addNewGSheetRow, 
  appendDisplayRowToSheet, 
  writeBatchSourceGeoId, 
  GSheetDisplayData, 
  GSheetSyncData,
  findRowByColAText,
  deleteRowFromSheet
} from "@/lib/google-sheets";
import { getUserPermissions } from "@/lib/permissions";
import { sendTelegramNotification } from "@/lib/telegram";
import { auth } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = "KIU Properties";

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export async function POST(request: Request) {
  const session = await auth();
  const updatedBy = session?.user?.email || session?.user?.name || "";

  try {
    const body = await request.json();
    const {
      region,
      province,
      city,
      barangay,
      area,
      building,
      type_description,
      status,
      lot_area,
      floor_area,
      price,
      lease_price,
      summary,
      residential,
      commercial,
      industrial,
      agricultural,
      with_income,
      direct_or_broker,
      owner_broker,
      how_many_away,
      listing_ownership,
      sale_or_lease,
      date_received,
      date_updated,
      fb_link,
      map_link,
      sale_price_per_sqm,
      lease_price_per_sqm,
      lat,
      long,
      bedrooms,
      toilet,
      garage,
      amenities,
      corner,
      compound,
      comments,
      photo_link,
      monthly_dues,
      geo_id,
      send_telegram,
      telegram_post_message,
      telegram_groups,
      col_q,
      col_r,
      batch_source_sheet_id,
      batch_source_sheet_gid,
      batch_row_number,
      batch_source_tab_name,
      location_verified,
      bp_post,
      bq_post,
      br_post,
      bs_post,
      bt_post,
      bu_post,
      bw_col,
      bx_col,
      by_col,
      bz_col,
    } = body;

    console.log("=== ADDING NEW LISTING ===");
    console.log("send_telegram:", send_telegram);
    console.log("telegram_groups:", telegram_groups);

    const userEmail = session?.user?.email;
    const userRole = (session?.user as any)?.role || "EDITOR";
    const permissions = userEmail ? await getUserPermissions(userEmail, userRole) : null;
    const isSuperAdmin = permissions?.sheet2 === true;

    // Fetch fb_group from luxe_listing_users (for BC stamp and Location Verified)
    let userGroup = updatedBy;
    if (updatedBy) {
      const { data: userRow } = await supabase
        .from("luxe_listing_users")
        .select("fb_group")
        .eq("email", updatedBy.toLowerCase())
        .maybeSingle();
      const fbGroup = (userRow as { fb_group?: string | null } | null)?.fb_group;
      if (fbGroup) userGroup = fbGroup;
    }

    // Determine target tab: SuperAdmins can choose, Admins always use Sheet1
    const targetTab = isSuperAdmin ? (batch_source_tab_name || "Sheet1") : "Sheet1";

    // --- Silent Transfer Logic ---
    // If adding to Sheet1, check if it secretly exists in Sheet2.
    if (targetTab === "Sheet1" && summary) {
      try {
        const spreadsheetId = process.env.SPREADSHEET_ID!;
        // Search Sheet2 (specifically) for a content match
        const sheet2Match = await findRowByColAText(summary, spreadsheetId, "Sheet2");
        if (sheet2Match && sheet2Match.rowNumber) {
          // If match found in Sheet2 and user is SuperAdmin, return error so UI can offer promotion
          if (isSuperAdmin) {
            return NextResponse.json(
              { 
                error: "EXISTING_IN_SHEET2", 
                message: "Listing already exists in Sheet2. Promote it instead?",
                match: sheet2Match 
              }, 
              { status: 409 }
            );
          }

          // Otherwise (Admin/Editor), perform Silent Transfer
          console.log(`🕵️ Silent Transfer: match found in Sheet2 row ${sheet2Match.rowNumber}. Deleting it...`);
          await deleteRowFromSheet(spreadsheetId, "Sheet2", sheet2Match.rowNumber);
          
          // Also cleanup the old GEO ID from Supabase if it had one
          if (sheet2Match.geoId) {
            console.log(`🗑️ Cleaning up old GEO ID ${sheet2Match.geoId} from Supabase...`);
            await supabase.from(TABLE_NAME).delete().eq('"GEO ID"', sheet2Match.geoId);
          }
        }
      } catch (err) {
        console.warn("⚠️ Silent transfer check/cleanup failed (non-fatal):", err);
      }
    }

    // Build type string from checkboxes
    const typeValues = [
      residential && "Residential",
      commercial && "Commercial",
      industrial && "Industrial",
      agricultural && "Agricultural",
    ].filter(Boolean);
    const typeString = typeValues.join(", ");

    // Determine price for column G based on sale_or_lease
    let priceValue = "";
    if (sale_or_lease === "Lease" && lease_price) {
      priceValue = lease_price.toString();
    } else if (price) {
      priceValue = price.toString();
    } else if (lease_price) {
      priceValue = lease_price.toString();
    }

    // Helper to remove commas from numbers
    const stripCommas = (val: string | number | null | undefined): string => {
      if (!val) return "";
      return val.toString().replace(/,/g, "");
    };

    // Step 1: Add to GSheet — build all columns (A-BO) and write in one append
    const derivedMapLink =
      lat && long
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${long}`
        : (lat === "" || long === "" ? null : (map_link || null));
    const latLongCombined = lat && long ? `${lat}, ${long}` : "";

    const displayData: GSheetDisplayData = {
      blastedFormat: summary || "",
      type: typeString,
      area: barangay || area || "",
      city: city || "",
      lotArea: stripCommas(lot_area),
      floorArea: stripCommas(floor_area),
      price: stripCommas(priceValue),
      saleOrLease: sale_or_lease || "",
      withIncome: with_income || "",
      directCobroker: direct_or_broker || "",
      ownerBroker: owner_broker || "",
      away: how_many_away || "",
      dateReceived: formatDisplayDate(date_received || new Date().toISOString().split("T")[0]),
      dateResorted: formatDisplayDate(date_updated || new Date().toISOString().split("T")[0]),
      available: status || "AVAILABLE",
      listingOwnership: listing_ownership || "",
      colQ: col_q || "",
      colR: col_r || "",
    };

    // syncData uses geo_id as placeholder — addNewGSheetRow will use the actual geoId for AA/AC
    const syncData: GSheetSyncData = {
      fbLink: fb_link || "",
      main: "",       // overridden inside addNewGSheetRow with correct geoId
      photo: photo_link || "",
      geoId: "",      // overridden inside addNewGSheetRow
      mapLink: derivedMapLink || "",
      region: region || "",
      province: province || "",
      city: city || "",
      barangay: barangay || "",
      area: area || "",
      building: building || "",
      residential: residential || "",
      commercial: commercial || "",
      industrial: industrial || "",
      agricultural: agricultural || "",
      lotArea: stripCommas(lot_area),
      floorArea: stripCommas(floor_area),
      status: status || "AVAILABLE",
      type: type_description || "",
      salePrice: stripCommas(price),
      saleSqm: stripCommas(sale_price_per_sqm),
      leasePrice: stripCommas(lease_price),
      leaseSqm: stripCommas(lease_price_per_sqm),
      comments: comments || "",
      withIncome: with_income || "",
      directBroker: direct_or_broker || "",
      name: owner_broker || "",
      away: how_many_away || "",
      monthlyDues: monthly_dues || "",
      dateRecv: formatDisplayDate(date_received || new Date().toISOString().split("T")[0]),
      dateUpdated: formatDisplayDate(date_updated || new Date().toISOString().split("T")[0]),
      listingOwnership: listing_ownership || "",
      latLong: latLongCombined,
      lat: lat || "",
      long: long || "",
      sponsorStart: "",
      sponsorEnd: "",
      bedrooms: bedrooms || "",
      toilet: toilet || "",
      garage: garage || "",
      amenities: amenities || "",
      corner: corner || "",
      compound: compound || "",
      bpPost: bp_post || "",
      bqPost: bq_post || "",
      brPost: br_post || "",
      bsPost: bs_post || "",
      btPost: bt_post || "",
      buPost: bu_post || "",
      bvCol: location_verified ? `Location Verified by ${userGroup} on ${formatDisplayDate(new Date().toISOString().split("T")[0])}` : "",
      bwCol: bw_col || "",
      bxCol: bx_col || "",
      byCol: by_col || "",
      bzCol: bz_col || "",
    };

    // GSheet write — append a new row (with override GEO ID if confirmed, or generate a new one)
    // When batch_source_tab_name is set (Sheet2 batch), write in-place to the source row.
    const newGeoId = await addNewGSheetRow(
      displayData,
      geo_id || undefined,
      syncData,
      updatedBy || undefined,
      undefined,
      targetTab,
      (batch_source_tab_name && batch_row_number) ? batch_row_number : undefined,
    );
    console.log("✅ GSheet write done, GEO ID:", newGeoId);

    // Write GEO ID back to Source GSheet — skip when batch_source_tab_name is set
    // (because addNewGSheetRow already wrote the GEO ID to the source row directly)
    let writebackError: string | null = null;
    console.log("=== WRITEBACK CHECK ===", { batch_source_sheet_id, batch_row_number, batch_source_tab_name, newGeoId });
    if (!batch_source_tab_name && batch_source_sheet_id && batch_row_number) {
      try {
        await writeBatchSourceGeoId(batch_source_sheet_id, batch_row_number, newGeoId, batch_source_sheet_gid || undefined, summary || undefined);
      } catch (err) {
        writebackError = err instanceof Error ? err.message : String(err);
        console.error("❌ Batch source GEO ID writeback failed:", writebackError);
      }
    }

    // Mirror to COPY GSheet — skip when batch_source_tab_name is set (Sheet2 data stays in Sheet2 only)
    const backupSpreadsheetId = process.env.BACKUP_SPREADSHEET_ID;
    let backupError: string | null = null;
    let backupSkipped = false;
    if (batch_source_tab_name) {
      backupSkipped = true;
      console.log("⏭️ COPY GSheet skipped — Sheet2 batch mode");
    } else if (!backupSpreadsheetId) {
      backupSkipped = true;
      console.warn("⚠️ BACKUP_SPREADSHEET_ID not set — backup skipped");
    } else {
      try {
        await appendDisplayRowToSheet(displayData, newGeoId, backupSpreadsheetId);
        console.log("✅ Backup GSheet row added for GEO ID:", newGeoId);
      } catch (err) {
        backupError = err instanceof Error ? err.message : String(err);
        console.error("❌ Backup GSheet append failed:", backupError);
      }
    }

    const mainWithGeoId = newGeoId + "\n" + (summary || "");

    // Step 2: Add to Supabase — upsert when geo_id is an override so we don't fail if it already exists

    const supabaseRecord = {
      "GEO ID": newGeoId,
      MAIN: mainWithGeoId,
      PHOTO: photo_link || null,
      REGION: region || null,
      PROVINCE: province || null,
      CITY: city || null,
      BARANGAY: barangay || null,
      AREA: area || null,
      BUILDING: building || null,
      TYPE: type_description || null,
      STATUS: status || "AVAILABLE",
      "LOT AREA": lot_area || null,
      "FLOOR AREA": floor_area || null,
      "Extracted Sale Price": price || null,
      "Extracted Lease Price": lease_price || null,
      "Sale Price/Sqm": sale_price_per_sqm || null,
      "Lease Price/Sqm": lease_price_per_sqm || null,
      "LAT LONG": lat && long ? `${lat}, ${long}` : null,
      RESIDENTIAL: residential || null,
      COMMERCIAL: commercial || null,
      INDUSTRIAL: industrial || null,
      AGRICULTURAL: agricultural || null,
      "WITH INCOME": with_income || null,
      "DIRECT OR BROKER": direct_or_broker || null,
      NAME: owner_broker || null,
      AWAY: how_many_away || null,
      "LISTING OWNERSHIP": listing_ownership || null,
      "DATE RECV": date_received || new Date().toISOString(),
      "DATE UPDATED": date_updated || new Date().toISOString(),
      "FB LINK": fb_link || null,
      "MAP LINK": map_link || null,
      LAT: lat || null,
      LONG: long || null,
      bedrooms: bedrooms || null,
      toilet: toilet || null,
      garage: garage || null,
      amenities: amenities || null,
      corner: corner || null,
      compound: compound || null,
      COMMENTS: comments || null,
      "MONTHLY DUES": monthly_dues || null,
      "SOURCE_TAB": targetTab,
      "MAP VERIFIED": location_verified 
        ? `Location Verified by ${userGroup} on ${formatDisplayDate(new Date().toISOString().split("T")[0])}` 
        : null,
    };

    // Use upsert when an override GEO ID was confirmed — handles the case where the
    // record already exists in Supabase (updates it) or doesn't (inserts it).
    const supabaseOp = geo_id
      ? supabase.from(TABLE_NAME).upsert(supabaseRecord, { onConflict: '"GEO ID"' }).select()
      : supabase.from(TABLE_NAME).insert(supabaseRecord).select();

    const { data, error } = await supabaseOp;

    if (error) {
      console.error("Supabase insert/upsert error:", error);
      return NextResponse.json(
        { error: "Failed to add listing to Supabase", details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Supabase ${geo_id ? "upserted" : "inserted"} for GEO ID:`, newGeoId);

    // Send Telegram notifications if requested
    if (send_telegram) {
      const groups: string[] | undefined = Array.isArray(telegram_groups) ? telegram_groups : undefined;
      // 1. Send default notification
      await sendTelegramNotification(`🆕 New Listing: ${newGeoId}\n\n${summary || ""}`, groups);
      // 2. Send custom message if provided
      if (telegram_post_message) {
        await sendTelegramNotification(telegram_post_message, groups);
      }
    }

    return NextResponse.json({
      success: true,
      geoId: newGeoId,
      data: data?.[0],
      writebackError: writebackError ?? undefined,
      backupError: backupError ?? (backupSkipped ? undefined : undefined),
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Add listing failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

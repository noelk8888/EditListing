import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addNewGSheetRow, GSheetDisplayData, GSheetSyncData } from "@/lib/google-sheets";
import { sendTelegramNotification } from "@/lib/telegram";
import { auth } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = "KIU Properties";

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
      geo_id,
      send_telegram,
      telegram_post_message,
      telegram_groups,
    } = body;

    console.log("=== ADDING NEW LISTING ===");
    console.log("send_telegram:", send_telegram);
    console.log("telegram_groups:", telegram_groups);

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
        : map_link || null;
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
      dateReceived: date_received || new Date().toISOString().split("T")[0],
      dateResorted: date_updated || new Date().toISOString().split("T")[0],
      available: status || "AVAILABLE",
      listingOwnership: listing_ownership || "",
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
      dateRecv: date_received || new Date().toISOString().split("T")[0],
      dateUpdated: date_updated || new Date().toISOString().split("T")[0],
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
    };

    // Single GSheet append — A-BO all written at once, no second lookup
    const newGeoId = await addNewGSheetRow(displayData, geo_id || undefined, syncData, updatedBy || undefined);
    console.log("✅ GSheet row added (A-BO) with GEO ID:", newGeoId);

    // Mirror to 2nd Backup GSheet (non-fatal)
    const backupSpreadsheetId = process.env.BACKUP_SPREADSHEET_ID;
    if (backupSpreadsheetId) {
      addNewGSheetRow(displayData, newGeoId, syncData, undefined, backupSpreadsheetId).catch((err) =>
        console.warn("⚠️ Backup GSheet append failed (non-fatal):", err)
      );
    }

    const mainWithGeoId = newGeoId + "\n" + (summary || "");

    // Step 2: Add to Supabase with the same GEO ID

    const { data, error } = await supabase.from(TABLE_NAME).insert({
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
    }).select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to add listing to Supabase", details: error.message },
        { status: 500 }
      );
    }

    console.log("✅ Supabase row added for GEO ID:", newGeoId);

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
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Add listing failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

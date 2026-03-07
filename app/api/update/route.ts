import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateDisplayColumns, updateSyncColumns, GSheetDisplayData, GSheetSyncData, NoteConfig } from "@/lib/google-sheets";
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
      id,
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
      sale_or_lease, // For GSheet column H
      date_received,
      date_updated,
      // MORE INFO fields
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
      sponsor_start,
      sponsor_end,
      photo_link,
      send_telegram,
      telegram_post_message,
      telegram_groups,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Listing ID is required" }, { status: 400 });
    }

    // Fetch current values to detect which tracked columns actually changed
    const { data: current } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq('"GEO ID"', id)
      .maybeSingle();

    const diff = (a: unknown, b: unknown) =>
      String(a ?? "").trim() !== String(b ?? "").trim();

    const noteCols = new Set<number>();
    if (updatedBy && current) {
      if (diff(date_updated, current["DATE UPDATED"])) { noteCols.add(13); noteCols.add(54); } // N, BC
      if (diff(status, current["STATUS"])) { noteCols.add(14); noteCols.add(42); } // O, AQ
      const latChanged = diff(lat, current["LAT"]);
      const longChanged = diff(long, current["LONG"]);
      if (latChanged || longChanged) noteCols.add(56); // BE
      if (latChanged) noteCols.add(57); // BF
      if (longChanged) noteCols.add(58); // BG
      if (diff(comments, current["COMMENTS"])) noteCols.add(48); // AW
    }
    const noteConfig: NoteConfig | undefined =
      updatedBy && noteCols.size > 0 ? { updatedBy, cols: noteCols } : undefined;

    // Always derive MAP LINK from lat/long when available; otherwise keep existing map_link
    const derivedMapLink =
      lat && long
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${long}`
        : map_link || null;

    console.log("=== UPDATING LISTING ===");
    console.log("ID:", id);
    console.log("send_telegram:", send_telegram);
    console.log("telegram_groups:", telegram_groups);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        "REGION": region || null,

        "PROVINCE": province || null,
        "CITY": city || null,
        "BARANGAY": barangay || null,
        "AREA": area || null,
        "BUILDING": building || null,
        "TYPE": type_description || null,
        "STATUS": status || null,
        "LOT AREA": lot_area || null,
        "FLOOR AREA": floor_area || null,
        "Extracted Sale Price": price || null,
        "Extracted Lease Price": lease_price || null,
        "MAIN": summary || null,
        "RESIDENTIAL": residential || null,
        "COMMERCIAL": commercial || null,
        "INDUSTRIAL": industrial || null,
        "AGRICULTURAL": agricultural || null,
        "WITH INCOME": with_income || null,
        "DIRECT OR BROKER": direct_or_broker || null,
        "NAME": owner_broker || null,
        "AWAY": how_many_away || null,
        "LISTING OWNERSHIP": listing_ownership || null,
        "DATE RECV": date_received || null,
        "DATE UPDATED": date_updated || null,
        // MORE INFO fields
        "FB LINK": fb_link || null,
        "MAP LINK": derivedMapLink || null,
        "Sale Price/Sqm": sale_price_per_sqm || null,
        "Lease Price/Sqm": lease_price_per_sqm || null,
        "LAT": lat || null,
        "LONG": long || null,
        "bedrooms": bedrooms || null,
        "toilet": toilet || null,
        "garage": garage || null,
        "amenities": amenities || null,
        "corner": corner || null,
        "compound": compound || null,
        "COMMENTS": comments || null,
        "SPONSOR START": sponsor_start || null,
        "SPONSOR END": sponsor_end || null,
        "PHOTO": photo_link || null,
      })
      .eq('"GEO ID"', id)
      .select('"GEO ID"');

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    }

    if (!data || data.length === 0) {
      // GSheet-only listing — INSERT into Supabase using the existing GEO ID
      console.warn(`⚠️ GEO ID ${id} not in Supabase — inserting new record`);
      const mainWithId = summary ? (summary.startsWith(id) ? summary : `${id}\n${summary}`) : id;
      const { error: insertError } = await supabase.from(TABLE_NAME).insert({
        "GEO ID": id,
        "MAIN": mainWithId,
        "PHOTO": photo_link || null,
        "REGION": region || null,
        "PROVINCE": province || null,
        "CITY": city || null,
        "BARANGAY": barangay || null,
        "AREA": area || null,
        "BUILDING": building || null,
        "TYPE": type_description || null,
        "STATUS": status || null,
        "LOT AREA": lot_area || null,
        "FLOOR AREA": floor_area || null,
        "Extracted Sale Price": price || null,
        "Extracted Lease Price": lease_price || null,
        "Sale Price/Sqm": sale_price_per_sqm || null,
        "Lease Price/Sqm": lease_price_per_sqm || null,
        "RESIDENTIAL": residential || null,
        "COMMERCIAL": commercial || null,
        "INDUSTRIAL": industrial || null,
        "AGRICULTURAL": agricultural || null,
        "WITH INCOME": with_income || null,
        "DIRECT OR BROKER": direct_or_broker || null,
        "NAME": owner_broker || null,
        "AWAY": how_many_away || null,
        "LISTING OWNERSHIP": listing_ownership || null,
        "DATE RECV": date_received || null,
        "DATE UPDATED": date_updated || null,
        "FB LINK": fb_link || null,
        "MAP LINK": derivedMapLink || null,
        "LAT": lat || null,
        "LONG": long || null,
        "bedrooms": bedrooms || null,
        "toilet": toilet || null,
        "garage": garage || null,
        "amenities": amenities || null,
        "corner": corner || null,
        "compound": compound || null,
        "COMMENTS": comments || null,
      });
      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return NextResponse.json({ error: `Supabase insert failed: ${insertError.message}` }, { status: 500 });
      }
      console.log(`✅ Supabase inserted new record for GEO ID: ${id}`);
    } else {
      console.log(`✅ Supabase updated ${data.length} row(s) for GEO ID:`, id);
    }

    // Build BLASTED FORMAT (A) - MAIN without GEO ID first line
    let blastedFormat = summary || "";
    if (blastedFormat.startsWith(id)) {
      const lines = blastedFormat.split('\n');
      blastedFormat = lines.slice(1).join('\n');
    }

    // Build COL AA (MAIN with GEO ID as first line)
    const mainWithId = summary ? (summary.startsWith(id) ? summary : `${id}\n${summary}`) : id;

    // Update GSheet columns A-P
    try {

      // Build type (B) from residential/commercial/industrial/agricultural
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

      const displayData: GSheetDisplayData = {
        blastedFormat,
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
        dateReceived: date_received || "",
        dateResorted: date_updated || "",
        available: status || "",
        listingOwnership: listing_ownership || "",
      };

      // Build lat/long combined for BE column
      const latLongCombined = lat && long ? `${lat}, ${long}` : "";

      const syncData: GSheetSyncData = {
        blastedFormat,              // COL A — written alongside Z-BO to guarantee update
        fbLink: fb_link || "",
        main: mainWithId,
        photo: photo_link || "",
        geoId: id,
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
        status: status || "",
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
        dateRecv: date_received || "",
        dateUpdated: date_updated || "",
        listingOwnership: listing_ownership || "",
        latLong: latLongCombined,
        lat: lat || "",
        long: long || "",
        sponsorStart: sponsor_start || "",
        sponsorEnd: sponsor_end || "",
        bedrooms: bedrooms || "",
        toilet: toilet || "",
        garage: garage || "",
        amenities: amenities || "",
        corner: corner || "",
        compound: compound || "",
      };

      // Run syncColumns FIRST so GEO ID lands in COL AC before displayColumns searches for it
      await updateSyncColumns(id, syncData, summary || "", noteConfig);
      console.log("✅ GSheet columns A + Z-BO updated successfully");

      const gsheetUpdated = await updateDisplayColumns(id, displayData, summary || "", noteConfig);
      if (gsheetUpdated) {
        console.log("✅ GSheet columns B-P updated successfully");
      } else {
        console.warn("⚠️ GSheet columns B-P update skipped - listing not found in GSheet");
      }
    } catch (gsheetError) {
      const msg = gsheetError instanceof Error ? gsheetError.message : String(gsheetError);
      console.error("GSheet update error:", gsheetError);
      return NextResponse.json(
        { error: `GSheet update failed: ${msg}` },
        { status: 500 }
      );
    }

    // Send Telegram notifications only when checkbox is checked
    if (send_telegram) {
      const groups: string[] | undefined = Array.isArray(telegram_groups) ? telegram_groups : undefined;
      await sendTelegramNotification(mainWithId, groups);
      if (telegram_post_message) {
        await sendTelegramNotification(telegram_post_message, groups);
      }
    }

    const supabaseUpdated = data && data.length > 0;
    return NextResponse.json({
      success: true,
      supabaseUpdated,
      warning: supabaseUpdated ? undefined : `GEO ID ${id} not found in Supabase — only GSheet was updated`,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

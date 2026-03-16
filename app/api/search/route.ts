import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRowByGeoId, findRowByColAText, generateNextGeoId, GSheetFullRow } from "@/lib/google-sheets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Table name in Supabase
const TABLE_NAME = "KIU Properties";

// Select columns for all queries
const SELECT_COLUMNS = `"GEO ID", "PHOTO", "MAIN", "REGION", "PROVINCE", "CITY", "BARANGAY", "AREA", "BUILDING", "LOT AREA", "FLOOR AREA", "STATUS", "TYPE", "Extracted Sale Price", "Extracted Lease Price", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL", "WITH INCOME", "DIRECT OR BROKER", "NAME", "AWAY", "LISTING OWNERSHIP", "DATE RECV", "DATE UPDATED", "FB LINK", "MAP LINK", "Sale Price/Sqm", "Lease Price/Sqm", "LAT LONG", "LAT", "LONG", "COMMENTS", "MONTHLY DUES", "SPONSOR START", "SPONSOR END", "bedrooms", "toilet", "garage", "amenities", "corner", "compound"`;

interface SupabaseResult {
  "GEO ID": string | null;
  "PHOTO": string | null;
  "MAIN": string | null;
  "REGION": string | null;
  "PROVINCE": string | null;
  "CITY": string | null;
  "BARANGAY": string | null;
  "AREA": string | null;
  "BUILDING": string | null;
  "LOT AREA": number | null;
  "FLOOR AREA": number | null;
  "STATUS": string | null;
  "TYPE": string | null;
  "Extracted Sale Price": number | null;
  "Extracted Lease Price": number | null;
  // Property type fields
  "RESIDENTIAL": string | null;
  "COMMERCIAL": string | null;
  "INDUSTRIAL": string | null;
  "AGRICULTURAL": string | null;
  // Additional Info fields
  "WITH INCOME": string | null;
  "DIRECT OR BROKER": string | null;
  "NAME": string | null;
  "AWAY": string | null;
  "LISTING OWNERSHIP": string | null;
  "DATE RECV": string | null;
  "DATE UPDATED": string | null;
  // MORE INFO fields
  "FB LINK": string | null;
  "MAP LINK": string | null;
  "Sale Price/Sqm": number | null;
  "Lease Price/Sqm": number | null;
  "LAT LONG": string | null;
  "LAT": string | null;
  "LONG": string | null;
  "COMMENTS": string | null;
  "SPONSOR START": string | null;
  "SPONSOR END": string | null;
  // These are lowercase in Supabase
  "bedrooms": string | null;
  "toilet": string | null;
  "garage": string | null;
  "amenities": string | null;
  "corner": string | null;
  "compound": string | null;
  "MONTHLY DUES": string | null;
}

// Extract a MAP LINK URL from listing text (COL A or COL AA).
// Matches "MAP LINK:", "Google Map:", "Google Maps:" followed by a URL (case-insensitive).
function extractMapLink(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/(?:MAP\s+LINK|GOOGLE\s+MAPS?)\s*[:\s]\s*(https?:\/\/[^\s\n]+)/i);
  return match ? match[1].trim() : null;
}

// Convert UTC timestamp to Philippines time (+0800) and return YYYY-MM-DD
function toPhilippinesDate(isoString: string | null): string | null {
  if (!isoString) return null;
  const utcDate = new Date(isoString);
  if (isNaN(utcDate.getTime())) return null;
  // Add 8 hours for Philippines timezone
  const phDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
  return phDate.toISOString().split('T')[0];
}

// Normalize a raw GSheet date string to YYYY-MM-DD for date inputs.
// Handles: "6-Mar-2025" (D-Mon-YYYY), "3/7/2025" (M/D/YYYY), "2025-03-07", ISO timestamps, serial numbers.
function normalizeGSheetDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO timestamp
  if (s.includes('T')) return s.split('T')[0];

  // D-Mon-YYYY or DD-Mon-YYYY (e.g. "6-Mar-2025", "07-Mar-2025") — GSheet formatted date
  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const dmonMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmonMatch) {
    const [, day, mon, year] = dmonMatch;
    const month = monthMap[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  // M/D/YYYY or MM/DD/YYYY (slash-separated)
  const slashParts = s.split('/');
  if (slashParts.length === 3) {
    const [m, d, y] = slashParts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Google Sheets serial date number (e.g. 45722 = Jan 27, 2025)
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 1000) {
      const d = new Date((serial - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
  }

  return s;
}

function supabaseToResult(row: SupabaseResult) {
  // Extract Sale/Lease from MAIN text (look for *FOR SALE*, *FOR LEASE*, etc.)
  const mainText = row["MAIN"] || "";
  let saleOrLease: string | null = null;
  if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(mainText)) {
    saleOrLease = "Sale/Lease";
  } else if (/\*?FOR\s+LEASE\*?/i.test(mainText)) {
    saleOrLease = "Lease";
  } else if (/\*?FOR\s+SALE\*?/i.test(mainText)) {
    saleOrLease = "Sale";
  }

  return {
    id: row["GEO ID"] || "N/A",
    photo_link: row["PHOTO"] || null,
    summary: row["MAIN"] || null,
    region: row["REGION"] || null,
    province: row["PROVINCE"] || null,
    city: row["CITY"] || null,
    barangay: row["BARANGAY"] || null,
    area: row["AREA"] || null,
    building: row["BUILDING"] || null,
    lot_area: row["LOT AREA"] || null,
    floor_area: row["FLOOR AREA"] || null,
    status: row["STATUS"] || null,
    type_description: row["TYPE"] || null,
    price: row["Extracted Sale Price"] || null,
    lease_price: row["Extracted Lease Price"] || null,
    // Property type fields
    residential: row["RESIDENTIAL"] || null,
    commercial: row["COMMERCIAL"] || null,
    industrial: row["INDUSTRIAL"] || null,
    agricultural: row["AGRICULTURAL"] || null,
    // Additional Info fields
    with_income: row["WITH INCOME"] || null,
    direct_or_broker: row["DIRECT OR BROKER"] || null,
    owner_broker: row["NAME"] || null,
    how_many_away: row["AWAY"] || null,
    listing_ownership: row["LISTING OWNERSHIP"] || null,
    sale_or_lease: saleOrLease,
    // Convert ISO timestamp to YYYY-MM-DD in Philippines time (+0800)
    date_received: toPhilippinesDate(row["DATE RECV"]),
    date_updated: toPhilippinesDate(row["DATE UPDATED"]),
    available: null as string | null, // Not in table - can be set manually
    // MORE INFO fields
    fb_link: row["FB LINK"] || null,
    map_link: row["MAP LINK"] || extractMapLink(row["MAIN"]) || null,
    sale_price_per_sqm: row["Sale Price/Sqm"] || null,
    lease_price_per_sqm: row["Lease Price/Sqm"] || null,
    property_type: row["TYPE"] || null,
    lat_long: row["LAT LONG"] || null,
    lat: row["LAT"] || null,
    long: row["LONG"] || null,
    bedrooms: row["bedrooms"] || null,
    toilet: row["toilet"] || null,
    garage: row["garage"] || null,
    amenities: row["amenities"] || null,
    corner: row["corner"] || null,
    compound: row["compound"] || null,
    comments: row["COMMENTS"] || null,
    monthly_dues: row["MONTHLY DUES"] || null,
    sponsor_start: row["SPONSOR START"] || null,
    sponsor_end: row["SPONSOR END"] || null,
  };
}

/**
 * Build a search result from GSheet row data only (when Supabase has no record).
 * Uses COL AA (main) first; if blank falls back to COL A (blastedFormat) with GEO ID prepended.
 */
function gsheetRowToResult(geoId: string, gsheetRow: GSheetFullRow): ReturnType<typeof supabaseToResult> {
  // Content: COL AA first, fallback to COL A with GEO ID prepended
  const content = gsheetRow.main || (gsheetRow.blastedFormat ? `${geoId}\n${gsheetRow.blastedFormat}` : "");

  // Extract Sale/Lease from content
  let saleOrLease: string | null = null;
  if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(content)) saleOrLease = "Sale/Lease";
  else if (/\*?FOR\s+LEASE\*?/i.test(content)) saleOrLease = "Lease";
  else if (/\*?FOR\s+SALE\*?/i.test(content)) saleOrLease = "Sale";

  const toNum = (v: string) => parseFloat(v.replace(/,/g, "")) || null;

  return {
    id: geoId,
    photo_link: gsheetRow.supabasePhoto || null,
    summary: content,
    region: gsheetRow.supabaseRegion || null,
    province: gsheetRow.supabaseProvince || null,
    city: gsheetRow.city || gsheetRow.supabaseCity || null,
    barangay: gsheetRow.area || gsheetRow.supabaseBarangay || null,
    area: gsheetRow.supabaseArea || null,
    building: gsheetRow.supabaseBuilding || null,
    lot_area: toNum(gsheetRow.lotArea || gsheetRow.supabaseLotArea),
    floor_area: toNum(gsheetRow.floorArea || gsheetRow.supabaseFloorArea),
    status: gsheetRow.available || gsheetRow.supabaseStatus || null,
    type_description: gsheetRow.supabaseType || gsheetRow.type || null,
    price: toNum(gsheetRow.price || gsheetRow.supabaseSalePrice),
    lease_price: toNum(gsheetRow.supabaseLeasePrice),
    residential: gsheetRow.supabaseResidential || null,
    commercial: gsheetRow.supabaseCommercial || null,
    industrial: gsheetRow.supabaseIndustrial || null,
    agricultural: gsheetRow.supabaseAgricultural || null,
    with_income: gsheetRow.withIncome || gsheetRow.supabaseWithIncome || null,
    direct_or_broker: gsheetRow.directCobroker || gsheetRow.supabaseDirectBroker || null,
    owner_broker: gsheetRow.ownerBroker || gsheetRow.supabaseName || null,
    how_many_away: gsheetRow.away || gsheetRow.supabaseAway || null,
    listing_ownership: gsheetRow.listingOwnership || gsheetRow.supabaseListingOwnership || null,
    sale_or_lease: saleOrLease,
    date_received: normalizeGSheetDate(gsheetRow.dateReceived),
    date_updated: normalizeGSheetDate(gsheetRow.dateResorted || gsheetRow.supabaseDateUpdated),
    available: gsheetRow.available || gsheetRow.supabaseStatus || null,
    fb_link: gsheetRow.supabaseFbLink || null,
    map_link: gsheetRow.supabaseMapLink || extractMapLink(gsheetRow.main) || extractMapLink(gsheetRow.blastedFormat) || null,
    sale_price_per_sqm: toNum(gsheetRow.supabaseSaleSqm),
    lease_price_per_sqm: toNum(gsheetRow.supabaseLeaseSqm),
    property_type: gsheetRow.supabaseType || gsheetRow.type || null,
    lat_long: gsheetRow.supabaseLat && gsheetRow.supabaseLong ? `${gsheetRow.supabaseLat}, ${gsheetRow.supabaseLong}` : null,
    lat: gsheetRow.supabaseLat || null,
    long: gsheetRow.supabaseLong || null,
    bedrooms: gsheetRow.supabaseBedrooms || null,
    toilet: gsheetRow.supabaseToilet || null,
    garage: gsheetRow.supabaseGarage || null,
    amenities: gsheetRow.supabaseAmenities || null,
    corner: gsheetRow.supabaseCorner || null,
    compound: gsheetRow.supabaseCompound || null,
    comments: gsheetRow.supabaseComments || null,
    monthly_dues: gsheetRow.supabaseMonthlyDues || null,
    sponsor_start: gsheetRow.supabaseSponsorStart || null,
    sponsor_end: gsheetRow.supabaseSponsorEnd || null,
  };
}

// Apply GSheet fallback for fields that are empty in Supabase
async function applyGSheetFallback(result: ReturnType<typeof supabaseToResult>): Promise<ReturnType<typeof supabaseToResult>> {
  if (!result.id || result.id === "N/A") {
    return result;
  }

  try {
    console.log("Fetching GSheet data for fallback...");
    const gsheetRow = await getRowByGeoId(result.id);

    if (!gsheetRow) {
      console.log("No GSheet row found for", result.id);
      return result;
    }

    console.log("GSheet fallback data found:");
    console.log("  GSheet dateReceived (M):", gsheetRow.dateReceived);
    console.log("  GSheet directCobroker (J):", gsheetRow.directCobroker);
    console.log("  GSheet ownerBroker (K):", gsheetRow.ownerBroker);
    console.log("  GSheet supabaseMonthlyDues (BB):", gsheetRow.supabaseMonthlyDues);

    // Helper: use first non-empty value
    const fallback = <T>(supabaseVal: T, gsheetVal: string | undefined): T | string => {
      if (supabaseVal !== null && supabaseVal !== undefined && supabaseVal !== "") {
        return supabaseVal;
      }
      return gsheetVal || supabaseVal;
    };

    // Summary: Supabase MAIN ↔ GSheet COL AA (main), fallback to COL A (blastedFormat) with GEO ID prepended
    const gsheetSummary = gsheetRow.main ||
      (gsheetRow.blastedFormat ? `${result.id}\n${gsheetRow.blastedFormat}` : "");

    // Apply fallback for linked columns
    return {
      ...result,
      // Summary: Supabase MAIN ↔ GSheet COL AA → COL A fallback
      summary: fallback(result.summary, gsheetSummary),
      // Date received: Supabase DATE RECV ↔ GSheet M (dateReceived)
      date_received: fallback(result.date_received, normalizeGSheetDate(gsheetRow.dateReceived) || ""),
      // Direct/Cobroker: Supabase DIRECT OR BROKER ↔ GSheet J (directCobroker) or AY (supabaseDirectBroker)
      direct_or_broker: fallback(result.direct_or_broker, gsheetRow.directCobroker || gsheetRow.supabaseDirectBroker),
      // Owner/Broker name: Supabase NAME ↔ GSheet K (ownerBroker) or AZ (supabaseName)
      owner_broker: fallback(result.owner_broker, gsheetRow.ownerBroker || gsheetRow.supabaseName),
      // How many away: Supabase AWAY ↔ GSheet L (away) or BA (supabaseAway)
      how_many_away: fallback(result.how_many_away, gsheetRow.away || gsheetRow.supabaseAway),
      // Listing ownership: Supabase LISTING OWNERSHIP ↔ GSheet P (listingOwnership) or BD
      listing_ownership: fallback(result.listing_ownership, gsheetRow.listingOwnership || gsheetRow.supabaseListingOwnership),
      // With income: Supabase WITH INCOME ↔ GSheet I (withIncome) or AX
      with_income: fallback(result.with_income, gsheetRow.withIncome || gsheetRow.supabaseWithIncome),
      // Status: Supabase STATUS ↔ GSheet O (available) or AQ
      status: fallback(result.status, gsheetRow.available || gsheetRow.supabaseStatus),
      // City: Supabase CITY ↔ GSheet D (city) or AG
      city: fallback(result.city, gsheetRow.city || gsheetRow.supabaseCity),
      // Barangay: Supabase BARANGAY ↔ GSheet C (area) or AH
      barangay: fallback(result.barangay, gsheetRow.area || gsheetRow.supabaseBarangay),
      // Area: Supabase AREA ↔ GSheet AI
      area: fallback(result.area, gsheetRow.supabaseArea),
      // Monthly dues: GSheet BB (supabaseMonthlyDues)
      monthly_dues: fallback(result.monthly_dues, gsheetRow.supabaseMonthlyDues),
    };
  } catch (gsheetError) {
    console.error("GSheet fallback error:", gsheetError);
    return result;
  }
}

export async function POST(request: Request) {
  try {
    const { photoLink, listingId, previewText } = await request.json();

    console.log("=== SUPABASE SEARCH ===");
    console.log("Photo link:", photoLink);
    console.log("Listing ID:", listingId);
    console.log("Preview text:", previewText?.substring(0, 80));

    if (!photoLink && !listingId && !previewText) {
      return NextResponse.json({ error: "No search criteria provided" }, { status: 400 });
    }

    // --- Strategy 1: Search by Listing ID (GEO ID) ---
    if (listingId) {
      console.log("Searching by GEO ID:", listingId);
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(SELECT_COLUMNS)
        .ilike('"GEO ID"', listingId)
        .limit(1);

      if (error) {
        console.error("Supabase error:", error);
      } else if (data && data.length > 0) {
        console.log("Found by GEO ID:", data[0]["GEO ID"]);
        console.log("DATE RECV:", data[0]["DATE RECV"]);
        console.log("DATE UPDATED:", data[0]["DATE UPDATED"]);
        console.log("RESIDENTIAL:", data[0]["RESIDENTIAL"]);
        console.log("COMMERCIAL:", data[0]["COMMERCIAL"]);
        console.log("STATUS:", data[0]["STATUS"]);
        console.log("WITH INCOME:", data[0]["WITH INCOME"]);
        console.log("DIRECT OR BROKER:", data[0]["DIRECT OR BROKER"]);
        console.log("NAME (owner):", data[0]["NAME"]);
        console.log("AWAY:", data[0]["AWAY"]);
        console.log("LISTING OWNERSHIP:", data[0]["LISTING OWNERSHIP"]);
        const result = await applyGSheetFallback(supabaseToResult(data[0] as SupabaseResult));
        return NextResponse.json({ result, matchedBy: "listingId" });
      }
      console.log("No match by GEO ID in Supabase, trying GSheet...");
      // --- Strategy 1b: GSheet fallback by GEO ID ---
      try {
        const gsheetRow = await getRowByGeoId(listingId);
        if (gsheetRow) {
          console.log("Found in GSheet by GEO ID:", listingId);
          const result = gsheetRowToResult(listingId, gsheetRow);
          return NextResponse.json({ result, matchedBy: "gsheetGeoId" });
        }
        console.log("Not found in GSheet either, no GEO ID match");
      } catch (gsheetErr) {
        console.error("GSheet GEO ID search error:", gsheetErr);
      }
    }

    // --- Strategy 2: Search by Photo Link ---
    if (photoLink) {
      // Extract unique ID from goo.gl URL
      const urlMatch = photoLink.match(/goo\.gl\/([a-zA-Z0-9]+)/);
      const searchTerm = urlMatch ? urlMatch[1] : photoLink;
      console.log("Searching by PHOTO containing:", searchTerm);

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(SELECT_COLUMNS)
        .ilike('"PHOTO"', `%${searchTerm}%`)
        .limit(1);

      if (error) {
        console.error("Supabase error:", error);
      } else if (data && data.length > 0) {
        console.log("Found by PHOTO:", data[0]["GEO ID"]);
        const result = await applyGSheetFallback(supabaseToResult(data[0] as SupabaseResult));
        return NextResponse.json({ result, matchedBy: "photoLink" });
      }
      console.log("No match by PHOTO");
    }

    // --- Strategy 3: Search by preview text (must match lines 5, 4, AND 3) ---
    if (previewText) {
      const lines = previewText.split('\n').filter((line: string) => line.trim());

      // Helper to check if line is significant
      const isSignificant = (line: string) =>
        line && line.length > 10 && !line.match(/^\*?(FOR SALE|FOR RENT|FOR LEASE)\*?$/i);

      // Get ALL significant lines for matching
      const significantLines = lines.filter(isSignificant).map((l: string) => l.trim());

      console.log("Significant lines for matching:", significantLines.length);
      significantLines.forEach((line: string, i: number) => console.log(`  [${i}]: ${line.substring(0, 50)}...`));

      if (significantLines.length < 3) {
        console.log("Not enough significant lines (need at least 3)");
      } else {
        // Strategy A: Search by Line 2 (address - index 1), verify ALL lines
        const line2 = lines[1] && isSignificant(lines[1]) ? lines[1].trim() : null;

        if (line2) {
          console.log("Strategy A: Searching by address...");

          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select(SELECT_COLUMNS)
            .ilike('"MAIN"', `%${line2}%`)
            .limit(20);

          if (!error && data && data.length > 0) {
            for (const row of data) {
              const mainText = (row["MAIN"] || "").toLowerCase();

              // Check how many significant lines match
              const matchCount = significantLines.filter((line: string) =>
                mainText.includes(line.toLowerCase())
              ).length;

              const matchRatio = matchCount / significantLines.length;
              console.log(`  Checking ${row["GEO ID"]}: ${matchCount}/${significantLines.length} lines match (${Math.round(matchRatio * 100)}%)`);

              // Require at least 80% of lines to match
              if (matchRatio >= 0.8) {
                console.log("Found match with Strategy A:", row["GEO ID"]);
                const result = await applyGSheetFallback(supabaseToResult(row as SupabaseResult));
                return NextResponse.json({ result, matchedBy: "text" });
              }
            }
            console.log("Strategy A: No match found");
          }
        }

        // Strategy B: Search by Line 3 (description - index 2), verify ALL lines
        const line3 = lines[2] && isSignificant(lines[2]) ? lines[2].trim() : null;

        if (line3) {
          console.log("Strategy B: Searching by description...");

          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select(SELECT_COLUMNS)
            .ilike('"MAIN"', `%${line3}%`)
            .limit(20);

          if (!error && data && data.length > 0) {
            for (const row of data) {
              const mainText = (row["MAIN"] || "").toLowerCase();

              // Check how many significant lines match
              const matchCount = significantLines.filter((line: string) =>
                mainText.includes(line.toLowerCase())
              ).length;

              const matchRatio = matchCount / significantLines.length;
              console.log(`  Checking ${row["GEO ID"]}: ${matchCount}/${significantLines.length} lines match (${Math.round(matchRatio * 100)}%)`);

              // Require at least 80% of lines to match
              if (matchRatio >= 0.8) {
                console.log("Found match with Strategy B:", row["GEO ID"]);
                const result = await applyGSheetFallback(supabaseToResult(row as SupabaseResult));
                return NextResponse.json({ result, matchedBy: "text" });
              }
            }
            console.log("Strategy B: No match found");
          }
        }
      }
      console.log("No match by text lines in Supabase, trying GSheet COL A...");
      // --- Strategy 4: GSheet COL A text search ---
      // Handles rows where COL AA (MAIN) is blank but COL A (BLASTED FORMAT) has content.
      // A blank COL AA does NOT mean the listing is new.
      try {
        const gsheetRow = await findRowByColAText(previewText);
        if (gsheetRow) {
          let geoId = gsheetRow.geoId;
          // COL AA empty → GEO ID empty: auto-assign the next available GEO ID immediately
          if (!geoId) {
            try {
              geoId = await generateNextGeoId();
              console.log("Auto-assigned new GEO ID for colA-match listing:", geoId);
            } catch (geoErr) {
              console.error("Failed to generate GEO ID:", geoErr);
              geoId = "colA-match";
            }
          }
          console.log("Found in GSheet COL A, GEO ID:", geoId);
          const result = gsheetRowToResult(geoId, gsheetRow);
          return NextResponse.json({ result, matchedBy: "gsheetColA" });
        }
        console.log("No match in GSheet COL A");
      } catch (gsheetErr) {
        console.error("GSheet COL A search error:", gsheetErr);
      }
    }

    console.log("=== NO MATCH FOUND ===");
    return NextResponse.json({ result: null });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

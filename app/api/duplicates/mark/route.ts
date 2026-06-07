import { NextResponse } from "next/server";
import { getSheets, getRowByRowNumber } from "@/lib/google-sheets";
import { createClient } from "@supabase/supabase-js";

// Col AA = index 26 (0-based). Col Q = index 16 (last column to format).
const COL_AA = "AA";
const FORMAT_END_COL = 17; // exclusive — covers A(0) through Q(16)

// Supabase admin client for flagging duplicate listings
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize a raw GSheet date string to YYYY-MM-DD for date inputs.
function normalizeGSheetDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.split('|')[0].trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.split('T')[0];

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const dmonMatch = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (dmonMatch) {
    const [, day, mon, year] = dmonMatch;
    const month = monthMap[mon.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  const spelledMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (spelledMatch) {
    const [, mon, day, year] = spelledMatch;
    const month = monthMap[mon.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  const slashParts = s.split('/');
  if (slashParts.length === 3) {
    const [m, d, y] = slashParts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 1000) {
      const d = new Date((serial - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
  }

  return s;
}

// Convert GSheetFullRow to Supabase row format
function gsheetRowToSupabaseRecord(row: any, geoIdOverride?: string) {
  const geoId = geoIdOverride || row.geoId;
  const lat = row.supabaseLat || "";
  const long = row.supabaseLong || "";
  const dateRecv = normalizeGSheetDate(row.dateReceived);
  const dateUpdated = normalizeGSheetDate(row.dateResorted || row.supabaseDateUpdated);

  return {
    "GEO ID": geoId,
    "MAIN": row.main || (row.blastedFormat ? `${geoId}\n${row.blastedFormat}` : ""),
    "PHOTO": row.supabasePhoto || null,
    "REGION": row.supabaseRegion || null,
    "PROVINCE": row.supabaseProvince || null,
    "CITY": row.city || row.supabaseCity || null,
    "BARANGAY": row.area || row.supabaseBarangay || null,
    "AREA": row.supabaseArea || null,
    "BUILDING": row.supabaseBuilding || null,
    "RESIDENTIAL": row.supabaseResidential || null,
    "COMMERCIAL": row.supabaseCommercial || null,
    "INDUSTRIAL": row.supabaseIndustrial || null,
    "AGRICULTURAL": row.supabaseAgricultural || null,
    "LOT AREA": parseFloat((row.lotArea || row.supabaseLotArea || "").toString().replace(/,/g, "")) || null,
    "FLOOR AREA": parseFloat((row.floorArea || row.supabaseFloorArea || "").toString().replace(/,/g, "")) || null,
    "STATUS": row.available || row.supabaseStatus || "AVAILABLE",
    "TYPE": row.supabaseType || row.type || null,
    "Extracted Sale Price": parseFloat((row.price || row.supabaseSalePrice || "").toString().replace(/,/g, "")) || null,
    "Sale Price/Sqm": parseFloat((row.supabaseSaleSqm || "").toString().replace(/,/g, "")) || null,
    "Extracted Lease Price": parseFloat((row.supabaseLeasePrice || "").toString().replace(/,/g, "")) || null,
    "Lease Price/Sqm": parseFloat((row.supabaseLeaseSqm || "").toString().replace(/,/g, "")) || null,
    "COMMENTS": row.supabaseComments || null,
    "WITH INCOME": row.withIncome || row.supabaseWithIncome || null,
    "DIRECT OR BROKER": row.directCobroker || row.supabaseDirectBroker || null,
    "NAME": row.ownerBroker || row.supabaseName || null,
    "AWAY": row.away || row.supabaseAway || null,
    "DATE RECV": dateRecv ? new Date(dateRecv).toISOString() : null,
    "DATE UPDATED": dateUpdated ? new Date(dateUpdated).toISOString() : null,
    "LISTING OWNERSHIP": row.listingOwnership || row.supabaseListingOwnership || null,
    "LAT LONG": lat && long ? `${lat}, ${long}` : null,
    "LAT": lat || null,
    "LONG": long || null,
    "SPONSOR START": row.supabaseSponsorStart || null,
    "SPONSOR END": row.supabaseSponsorEnd || null,
    "bedrooms": row.supabaseBedrooms || null,
    "toilet": row.supabaseToilet || null,
    "garage": row.supabaseGarage || null,
    "amenities": row.supabaseAmenities || null,
    "corner": row.supabaseCorner || null,
    "compound": row.supabaseCompound || null,
    "MONTHLY DUES": row.supabaseMonthlyDues || null,
    "SOURCE_TAB": row.sourceTab || "Sheet1",
    "MAP VERIFIED": row.mapVerified || null,
  };
}

export async function POST(req: Request) {
  try {
    const { spreadsheetId, originalRowNumber, originalGeoId, originalText, duplicateRowNumbers, duplicateTexts } =
      await req.json();

    const activeSpreadsheetId = spreadsheetId || process.env.SPREADSHEET_ID;

    if (!activeSpreadsheetId || !originalRowNumber || !originalGeoId || !duplicateRowNumbers?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sheets = getSheets();

    // 1. Get Sheet1's sheetId for formatting requests
    const meta = await sheets.spreadsheets.get({ spreadsheetId: activeSpreadsheetId });
    const sheet1 = meta.data.sheets?.find(
      (s: any) => s.properties?.title === "Sheet1"
    );
    const sheet1Id = sheet1?.properties?.sheetId;

    // 2. Retrieve and Validate Original Row
    const originalRow = await getRowByRowNumber(originalRowNumber, "Sheet1");
    if (!originalRow) {
      return NextResponse.json({ error: `Original row ${originalRowNumber} not found in Google Sheets` }, { status: 400 });
    }
    const cleanOriginalGeoId = originalGeoId.trim().toUpperCase();
    const sheetOriginalGeoId = (originalRow.geoId || "").trim().toUpperCase();
    if (sheetOriginalGeoId !== cleanOriginalGeoId) {
      return NextResponse.json({ 
        error: `Original row GEO ID mismatch. Expected ${cleanOriginalGeoId}, found ${sheetOriginalGeoId} in row ${originalRowNumber}` 
      }, { status: 400 });
    }

    // 2b. Fetch existing AC (GEO ID) values from Sheet1 to build a list of existing GEO-IDs
    const acRes = await sheets.spreadsheets.values.get({
      spreadsheetId: activeSpreadsheetId,
      range: "Sheet1!AC2:AC",
    });
    const existingGeoIds = new Set<string>(
      (acRes.data.values || [])
        .map((row: any) => (row[0] || "").trim().toUpperCase())
        .filter(Boolean)
    );

    const oldDuplicateGeoIdsToDelete: string[] = [];
    const updateData: any[] = [];
    const duplicateListingsToSync: any[] = [];

    // 3. Process each duplicate row
    for (const rowNum of duplicateRowNumbers) {
      const duplicateRow = await getRowByRowNumber(rowNum, "Sheet1");
      if (!duplicateRow) {
        return NextResponse.json({ error: `Duplicate row ${rowNum} not found in Google Sheets` }, { status: 400 });
      }

      const duplicateGeoId = (duplicateRow.geoId || "").trim();
      const cleanDuplicateGeoId = duplicateGeoId.toUpperCase();
      
      // Calculate a unique duplicate GEO ID starting with original GEO ID + -D
      let newDuplicateGeoId = cleanOriginalGeoId.endsWith("-D")
        ? cleanOriginalGeoId
        : `${cleanOriginalGeoId}-D`;

      // If this calculated GEO ID is already in the sheet (or was already assigned to another duplicate in this loop),
      // keep appending "-D" until it is unique.
      while (existingGeoIds.has(newDuplicateGeoId.toUpperCase())) {
        newDuplicateGeoId = `${newDuplicateGeoId}-D`;
      }

      // Add the assigned GEO ID to our set to prevent conflicts within the same request
      existingGeoIds.add(newDuplicateGeoId.toUpperCase());

      // If the duplicate row currently has a different GEO ID that is not our target duplicate ID,
      // stage the old duplicate ID for deletion from Supabase to prevent orphaned records.
      if (cleanDuplicateGeoId && cleanDuplicateGeoId !== newDuplicateGeoId.toUpperCase()) {
        oldDuplicateGeoIdsToDelete.push(duplicateGeoId);
      }

      // Format description with duplicate tag
      let updatedText = "";
      if (duplicateTexts && duplicateTexts[rowNum]) {
        updatedText = duplicateTexts[rowNum];
      } else {
        const currentColA = duplicateRow.blastedFormat || "";
        const lines = currentColA.split("\n");
        const firstLine = lines[0]?.trim();
        const duplicateTag = `*DUPLICATE Row ${originalRowNumber} - ${originalGeoId}*`;
        
        // Clean existing duplicate tags to prevent duplicates of tags
        const cleanLines = lines.filter((line: string) => !line.toUpperCase().includes("*DUPLICATE ROW"));
        
        if (firstLine.toUpperCase() === duplicateGeoId.toUpperCase()) {
          cleanLines.splice(1, 0, duplicateTag);
        } else {
          cleanLines.unshift(duplicateTag);
        }
        updatedText = cleanLines.join("\n");
      }

      // Stage duplicate row GSheet updates
      updateData.push(
        { range: `Sheet1!A${rowNum}`, values: [[updatedText]] },
        { range: `Sheet1!${COL_AA}${rowNum}`, values: [[updatedText]] }
      );
      if (newDuplicateGeoId && newDuplicateGeoId !== duplicateGeoId) {
        updateData.push({ range: `Sheet1!AC${rowNum}`, values: [[newDuplicateGeoId]] });
      }

      // Keep record for Supabase sync
      duplicateRow.geoId = newDuplicateGeoId;
      duplicateRow.main = newDuplicateGeoId + "\n" + updatedText;
      duplicateListingsToSync.push(duplicateRow);
    }

    // 4. Stage GSheet updates for Original row
    if (originalText !== undefined) {
      const mainWithId = `${originalGeoId}\n${originalText}`;
      updateData.push(
        { range: `Sheet1!A${originalRowNumber}`, values: [[originalText]] },
        { range: `Sheet1!${COL_AA}${originalRowNumber}`, values: [[mainWithId]] }
      );
      originalRow.main = mainWithId;
    }

    // 5. Execute Google Sheets batch updates
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: activeSpreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updateData,
      },
    });

    // 6. Format duplicate rows in Google Sheets (black background, bold white text)
    if (sheet1Id !== undefined) {
      const formattingRequests = duplicateRowNumbers.map((rowNum: number) => ({
        repeatCell: {
          range: {
            sheetId: sheet1Id,
            startRowIndex: rowNum - 1,
            endRowIndex: rowNum,
            startColumnIndex: 0,
            endColumnIndex: FORMAT_END_COL,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0, green: 0, blue: 0 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
              },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: activeSpreadsheetId,
        requestBody: {
          requests: formattingRequests,
        },
      });
    }

    // 7. Delete old duplicate GEO IDs from Supabase to prevent orphaned records
    if (oldDuplicateGeoIdsToDelete.length > 0) {
      console.log("Deleting old duplicate GEO-IDs from Supabase to prevent orphans:", oldDuplicateGeoIdsToDelete);
      const { error: deleteErr } = await supabaseAdmin
        .from("KIU Properties")
        .delete()
        .in('"GEO ID"', oldDuplicateGeoIdsToDelete);

      if (deleteErr) {
        console.warn("Failed to delete old duplicate GEO-IDs from Supabase:", deleteErr.message);
      } else {
        console.log(`Successfully deleted ${oldDuplicateGeoIdsToDelete.length} orphaned record(s) from Supabase.`);
      }
    }

    // 8. Update Supabase with duplicate records
    for (const dupRow of duplicateListingsToSync) {
      if (dupRow.geoId) {
        const supaRecord = gsheetRowToSupabaseRecord(dupRow);
        
        const { error: supaErr } = await supabaseAdmin
          .from("KIU Properties")
          .upsert(supaRecord, { onConflict: '"GEO ID"' });

        if (supaErr) {
          console.warn(`Supabase upsert failed for duplicate ${dupRow.geoId}:`, supaErr.message);
        }
      }
    }

    // 8. Update Supabase with original record to separate it from duplicate
    if (originalGeoId) {
      const originalSupaRecord = gsheetRowToSupabaseRecord(originalRow);
      
      const { error: supaErr } = await supabaseAdmin
        .from("KIU Properties")
        .upsert(originalSupaRecord, { onConflict: '"GEO ID"' });

      if (supaErr) {
        console.warn(`Supabase upsert failed for original ${originalGeoId}:`, supaErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      markedCount: duplicateRowNumbers.length,
    });
  } catch (err: any) {
    console.error("Mark duplicates error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

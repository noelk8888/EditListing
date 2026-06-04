import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google-sheets";
import { createClient } from "@supabase/supabase-js";

// Col AA = index 26 (0-based). Col Q = index 16 (last column to format).
const COL_AA = "AA";
const FORMAT_END_COL = 17; // exclusive — covers A(0) through Q(16)

// Supabase admin client for flagging duplicate listings
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { spreadsheetId, originalRowNumber, originalGeoId, originalText, duplicateRowNumbers, duplicateTexts } =
      await req.json();

    const activeSpreadsheetId = spreadsheetId || process.env.SPREADSHEET_ID;

    if (!activeSpreadsheetId || !originalRowNumber || !originalGeoId || !duplicateRowNumbers?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sheets = getSheets();

    // Get Sheet1's sheetId for formatting requests
    const meta = await sheets.spreadsheets.get({ spreadsheetId: activeSpreadsheetId });
    const sheet1 = meta.data.sheets?.find(
      (s: any) => s.properties?.title === "Sheet1"
    );
    const sheet1Id = sheet1?.properties?.sheetId;

    for (const rowNum of duplicateRowNumbers) {
      // 1. Read Col A (listing text) AND Col AC (GEO ID) in one call
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: activeSpreadsheetId,
        range: `Sheet1!A${rowNum}:AC${rowNum}`,
      });
      const row = readRes.data.values?.[0] || [];
      const currentColA = (row[0] || "").toString();
      const duplicateGeoId = (row[28] || "").toString().trim(); // Col AC = index 28

      // 2. Format description with duplicate tag: check for client-provided custom text or format dynamically
      let updatedText = "";
      if (duplicateTexts && duplicateTexts[rowNum]) {
        updatedText = duplicateTexts[rowNum];
      } else {
        const lines = currentColA.split("\n");
        const firstLine = lines[0]?.trim();
        const duplicateTag = `*DUPLICATE Row ${originalRowNumber} - ${originalGeoId}*`;
        
        // Clean existing duplicate tags to prevent duplicates of tags (case-insensitive check)
        const cleanLines = lines.filter((line: string) => !line.toUpperCase().includes("*DUPLICATE ROW"));
        
        if (firstLine.toUpperCase() === duplicateGeoId.toUpperCase()) {
          cleanLines.splice(1, 0, duplicateTag);
        } else {
          cleanLines.unshift(duplicateTag);
        }
        updatedText = cleanLines.join("\n");
      }

      // 3. Write updated text to Col A and Col AA
      const updateData = [
        { range: `Sheet1!A${rowNum}`, values: [[updatedText]] },
        { range: `Sheet1!${COL_AA}${rowNum}`, values: [[updatedText]] },
      ];

      if (originalText !== undefined) {
        updateData.push(
          { range: `Sheet1!A${originalRowNumber}`, values: [[originalText]] },
          { range: `Sheet1!${COL_AA}${originalRowNumber}`, values: [[originalGeoId]] }
        );
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: activeSpreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updateData,
        },
      });

      // 4. Format Col A:Q — black background, bold white text
      if (sheet1Id !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: activeSpreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: sheet1Id,
                    startRowIndex: rowNum - 1, // 0-indexed
                    endRowIndex: rowNum,
                    startColumnIndex: 0,           // Col A
                    endColumnIndex: FORMAT_END_COL, // Col Q (exclusive)
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
              },
            ],
          },
        });
      }

      // 5. Flag as duplicate in Supabase so it's excluded from search & count
      if (duplicateGeoId) {
        const { error: supaErr } = await supabaseAdmin
          .from("KIU Properties")
          .update({ 
            "MAIN": updatedText,
            "DATE UPDATED": new Date().toISOString()
          })
          .eq("GEO ID", duplicateGeoId);

        if (supaErr) {
          console.warn(`Supabase update failed for ${duplicateGeoId}:`, supaErr.message);
          // Non-fatal — GSheet is already updated
        }
      }

      // 6. Update original in Supabase
      if (originalGeoId && originalText !== undefined) {
        const { error: supaErr } = await supabaseAdmin
          .from("KIU Properties")
          .update({ 
            "MAIN": originalText,
            "AWAY": originalGeoId,
            "DATE UPDATED": new Date().toISOString()
          })
          .eq("GEO ID", originalGeoId);

        if (supaErr) {
          console.warn(`Supabase update failed for original ${originalGeoId}:`, supaErr.message);
        }
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

import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google-sheets";

// Col AA = index 26 (0-based). Col Q = index 16 (last column to format).
const COL_AA = "AA";
const FORMAT_END_COL = 17; // exclusive — covers A(0) through Q(16)

export async function POST(req: Request) {
  try {
    const { spreadsheetId, originalRowNumber, originalGeoId, duplicateRowNumbers } =
      await req.json();

    if (!spreadsheetId || !originalRowNumber || !originalGeoId || !duplicateRowNumbers?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sheets = getSheets();

    // Get Sheet1's sheetId for formatting requests
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet1 = meta.data.sheets?.find(
      (s: any) => s.properties?.title === "Sheet1"
    );
    const sheet1Id = sheet1?.properties?.sheetId;

    for (const rowNum of duplicateRowNumbers) {
      // 1. Read current Col A text
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `Sheet1!A${rowNum}`,
      });
      const currentColA = (readRes.data.values?.[0]?.[0] || "").toString();

      // 2. Replace the first line with the duplicate tag
      const lines = currentColA.split("\n");
      lines[0] = `*DUPLICATE Row ${originalRowNumber} - ${originalGeoId}*`;
      const updatedText = lines.join("\n");

      // 3. Write updated text to Col A and Col AA
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `Sheet1!A${rowNum}`, values: [[updatedText]] },
            { range: `Sheet1!${COL_AA}${rowNum}`, values: [[updatedText]] },
          ],
        },
      });

      // 4. Format Col A:Q — black background, bold white text
      if (sheet1Id !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
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

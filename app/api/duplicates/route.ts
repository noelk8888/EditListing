import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google-sheets";

// Extract spreadsheet ID from a Google Sheets URL
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Extract the unique slug from a Google Photos URL (goo.gl/AbCdEfG)
function extractPhotoSlug(photoUrl: string): string | null {
  if (!photoUrl) return null;
  const match = photoUrl.match(/goo\.gl\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Extract significant lines from listing text for fuzzy matching
function extractSignificantLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(
      (l) =>
        l.length > 10 &&
        !/^\*?(for sale|for rent|for lease|for sale\/lease|don't post|do not post)\*?$/i.test(l) &&
        !/^photos?:/i.test(l)
    );
}

interface SheetRow {
  rowNumber: number;
  colA: string;   // listing text
  colAB: string;  // photo link
  colAC: string;  // GEO ID
}

export async function POST(req: Request) {
  try {
    const { sheetUrl } = await req.json();
    if (!sheetUrl) {
      return NextResponse.json({ error: "Missing sheetUrl" }, { status: 400 });
    }

    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
    }

    const sheets = getSheets();

    // ── Step 1: Read Sheet1 columns A, AB, AC ──────────────────────────────
    // Range A2:AC covers columns 0 (A) through 28 (AC)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A2:AC",
    });

    const rawRows = response.data.values || [];
    const rows: SheetRow[] = rawRows
      .map((row, i) => ({
        rowNumber: i + 2, // +2 for header + 0-index
        colA: (row[0] || "").toString().trim(),
        colAB: (row[27] || "").toString().trim(), // Col AB = index 27
        colAC: (row[28] || "").toString().trim(), // Col AC = index 28
      }))
      .filter((r) => r.colA); // skip truly empty rows

    // Map rowNumber → row for quick lookup
    const rowsMap = new Map<number, SheetRow>(rows.map((r) => [r.rowNumber, r]));

    // ── Step 2: Phase 1 — Photo Link Matching ─────────────────────────────
    const photoGroups = new Map<string, number[]>();
    for (const row of rows) {
      const slug = extractPhotoSlug(row.colAB);
      if (!slug) continue;
      if (!photoGroups.has(slug)) photoGroups.set(slug, []);
      photoGroups.get(slug)!.push(row.rowNumber);
    }
    const photoMatches = [...photoGroups.values()].filter((g) => g.length >= 2);
    const matchedRowNumbers = new Set<number>(photoMatches.flat());

    // ── Step 3: Phase 2 — Fuzzy Text Matching (unmatched rows only) ────────
    const unmatched = rows.filter((r) => !matchedRowNumbers.has(r.rowNumber) && r.colA.length > 20);
    const fuzzyMatches: number[][] = [];
    const fuzzyMatchedRows = new Set<number>();

    for (let i = 0; i < unmatched.length; i++) {
      if (fuzzyMatchedRows.has(unmatched[i].rowNumber)) continue;
      const sigLines = extractSignificantLines(unmatched[i].colA);
      if (sigLines.length < 3) continue;

      const group = [unmatched[i].rowNumber];
      for (let j = i + 1; j < unmatched.length; j++) {
        if (fuzzyMatchedRows.has(unmatched[j].rowNumber)) continue;
        const colAj = unmatched[j].colA.toLowerCase();
        const matchCount = sigLines.filter((line) => colAj.includes(line)).length;
        if (matchCount / sigLines.length >= 0.8) {
          group.push(unmatched[j].rowNumber);
        }
      }

      if (group.length >= 2) {
        fuzzyMatches.push(group);
        group.forEach((r) => fuzzyMatchedRows.add(r));
      }
    }

    // ── Step 4: Build output rows ──────────────────────────────────────────
    const outputRows: string[][] = [];

    for (const rowNums of photoMatches) {
      const geoIds = rowNums
        .map((n) => rowsMap.get(n)?.colAC)
        .filter(Boolean)
        .join(", ");
      const sampleText = rowsMap.get(rowNums[0])?.colA || "";
      outputRows.push([geoIds, rowNums.join(", "), sampleText, "Photo Match"]);
    }

    for (const rowNums of fuzzyMatches) {
      const geoIds = rowNums
        .map((n) => rowsMap.get(n)?.colAC)
        .filter(Boolean)
        .join(", ");
      const sampleText = rowsMap.get(rowNums[0])?.colA || "";
      outputRows.push([geoIds, rowNums.join(", "), sampleText, "Fuzzy Match"]);
    }

    const totalDuplicates = outputRows.length;

    if (totalDuplicates === 0) {
      return NextResponse.json({ success: true, duplicateCount: 0, message: "No duplicates found!" });
    }

    // ── Step 5: Create a new output tab ───────────────────────────────────
    const tabName = `Duplicates - ${new Date().toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    })}`;

    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });

    // Write header + results
    const header = ["GEO ID(s)", "Row Numbers", "Sample Format", "Match Type"];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [header, ...outputRows],
      },
    });

    // Bold the header row
    const metaResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const newSheet = metaResponse.data.sheets?.find(
      (s: any) => s.properties?.title === tabName
    );
    const newSheetId = newSheet?.properties?.sheetId;

    if (newSheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
            // Freeze header row
            {
              updateSheetProperties: {
                properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }

    const outputUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return NextResponse.json({
      success: true,
      duplicateCount: totalDuplicates,
      tabName,
      outputUrl,
      photoMatchCount: photoMatches.length,
      fuzzyMatchCount: fuzzyMatches.length,
    });
  } catch (err: any) {
    console.error("Duplicate check error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

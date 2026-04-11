import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google-sheets";

function extractSpreadsheetId(url: string): { id: string | null; gid: string | null } {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[#?&]gid=([0-9]+)/);
  return {
    id: idMatch ? idMatch[1] : null,
    gid: gidMatch ? gidMatch[1] : null
  };
}

async function getTabNameFromGid(sheets: any, spreadsheetId: string, gid: string | null): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = meta.data.sheets || [];
  
  if (gid) {
    const found = allSheets.find((s: any) => s.properties?.sheetId?.toString() === gid);
    if (found?.properties?.title) return found.properties.title;
  }
  return allSheets[0]?.properties?.title || "Sheet1";
}

function extractPhotoSlug(text: string): string | null {
  if (!text) return null;
  const match = text.match(/goo\.gl\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractSignificantLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(
      (l) =>
        l.length > 10 &&
        !/^\*?(for sale|for rent|for lease|for sale\/lease|don't post|do not post|leased out|sold)\*?$/i.test(l) &&
        !/^photos?:/i.test(l)
    );
}

interface SheetRow {
  rowNumber: number;
  colA: string;   // listing text
  colAB: string;  // photo link (index 27)
  colAC: string;  // GEO ID (index 28)
}

export async function POST(req: Request) {
  try {
    const { sourceUrl, targetUrl } = await req.json();
    if (!sourceUrl || !targetUrl) return NextResponse.json({ error: "Missing URLs" }, { status: 400 });

    const { id: id1, gid: gid1 } = extractSpreadsheetId(sourceUrl);
    const { id: id2, gid: gid2 } = extractSpreadsheetId(targetUrl);
    
    if (!id1 || !id2) return NextResponse.json({ error: "Invalid sheet URLs" }, { status: 400 });

    const sheets = getSheets();

    const [tabName1, tabName2] = await Promise.all([
      getTabNameFromGid(sheets, id1, gid1),
      getTabNameFromGid(sheets, id2, gid2)
    ]);

    // Fetch data from both
    const [res1, res2] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: id1, range: `${tabName1}!A2:AC` }),
      sheets.spreadsheets.values.get({ spreadsheetId: id2, range: `${tabName2}!A2:AC` })
    ]);

    const mapRows = (values: any[][]) => (values || []).map((row, i) => ({
      rowNumber: i + 2,
      colA: (row[0] || "").toString().trim(),
      colAB: (row[27] || "").toString().trim(),
      colAC: (row[28] || "").toString().trim(),
    })).filter(r => r.colA);

    const sourceRows = mapRows(res1.data.values || []);
    const targetRows = mapRows(res2.data.values || []);

    const matches: any[] = [];
    let photoMatchCount = 0;
    let fuzzyMatchCount = 0;

    // Process Target Rows for quick lookup
    const targetByPhoto = new Map<string, SheetRow[]>();
    targetRows.forEach(r => {
      const slug = extractPhotoSlug(r.colAB);
      if (slug) {
        if (!targetByPhoto.has(slug)) targetByPhoto.set(slug, []);
        targetByPhoto.get(slug)!.push(r);
      }
    });

    // Match Source against Target
    for (const sRow of sourceRows) {
      let matchedInTarget = false;
      const slug = extractPhotoSlug(sRow.colAB);
      
      // 1. Photo Match
      if (slug && targetByPhoto.has(slug)) {
        const tRows = targetByPhoto.get(slug)!;
        matches.push({
          sourceRow: sRow,
          targetRows: tRows,
          type: "Photo Match",
          geoIdsTarget: tRows.map(tr => tr.colAC).filter(Boolean).join(", "),
          targetRowNums: tRows.map(tr => tr.rowNumber).join(", ")
        });
        photoMatchCount++;
        matchedInTarget = true;
      }

      // 2. Fuzzy Match (only if photo didn't match)
      if (!matchedInTarget && sRow.colA.length > 20) {
        const sSigLines = extractSignificantLines(sRow.colA);
        if (sSigLines.length >= 3) {
          const matchedTRows = targetRows.filter(tRow => {
            const tText = tRow.colA.toLowerCase();
            const matchCount = sSigLines.filter(line => tText.includes(line)).length;
            return (matchCount / sSigLines.length >= 0.8);
          });

          if (matchedTRows.length > 0) {
            matches.push({
              sourceRow: sRow,
              targetRows: matchedTRows,
              type: "Fuzzy Match",
              geoIdsTarget: matchedTRows.map(tr => tr.colAC).filter(Boolean).join(", "),
              targetRowNums: matchedTRows.map(tr => tr.rowNumber).join(", ")
            });
            fuzzyMatchCount++;
          }
        }
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Clean cross-check! No items from Source found in Target." });
    }

    // Create Output Tab in Target Spreadsheet (id2)
    const tabName = `CrossCheck - ${new Date().toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila"
    })}`;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id2,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
    });

    const header = ["Source Row", "Source Geo ID", "Match Type", "Target Row(s)", "Target Geo ID(s)", "Source Listing Text"];
    const outputData = matches.map(m => [
      m.sourceRow.rowNumber.toString(),
      m.sourceRow.colAC,
      m.type,
      m.targetRowNums,
      m.geoIdsTarget,
      m.sourceRow.colA
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: id2,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header, ...outputData] }
    });

    return NextResponse.json({
      success: true,
      count: matches.length,
      photoMatchCount,
      fuzzyMatchCount,
      tabName,
      outputUrl: `https://docs.google.com/spreadsheets/d/${id2}`
    });

  } catch (err: any) {
    console.error("Cross-check error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

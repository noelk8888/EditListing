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
  
  // Default to first sheet if gid not found or not provided
  return allSheets[0]?.properties?.title || "Sheet1";
}

function extractPhotoSlug(text: string): string | null {
  if (!text) return null;
  const match = text.match(/goo\.gl\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Clean text by removing status keywords but keeping other content
function cleanListingText(text: string): string {
  if (!text) return "";
  
  // Status patterns to ignore (handles asterisks, spaces, and punctuation around the keyword)
  const statusRegex = /^[^\w]*(for sale|sold|leased out|for lease|leased|off the market|delisted|for sale\/lease|available)[^\w]*$/im;
  
  return text
    .split("\n")
    .map(line => line.trim())
    // Filter out lines that are JUST a status keyword
    .filter(line => line && !statusRegex.test(line))
    .join("\n")
    .toLowerCase();
}

// Significant lines for fuzzy matching (fallback)
function getSignificantLines(text: string): string[] {
  const cleaned = cleanListingText(text);
  return cleaned
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 10 && !/^photos?:/i.test(l));
}

export async function POST(req: Request) {
  try {
    const { url1, url2 } = await req.json();
    if (!url1 || !url2) return NextResponse.json({ error: "Missing sheet URLs" }, { status: 400 });

    const { id: id1, gid: gid1 } = extractSpreadsheetId(url1);
    const { id: id2, gid: gid2 } = extractSpreadsheetId(url2);
    
    if (!id1 || !id2) return NextResponse.json({ error: "Invalid sheet URLs" }, { status: 400 });

    const sheets = getSheets();

    // Resolve Dynamic Tab Names
    const [tabName1, tabName2] = await Promise.all([
      getTabNameFromGid(sheets, id1, gid1),
      getTabNameFromGid(sheets, id2, gid2)
    ]);

    console.log(`Comparing "${id1}" [${tabName1}] vs "${id2}" [${tabName2}]`);

    // 1. Fetch both sheets (Columns A and AC)
    // we fetch A to AC to get Listing Text (0) and GEO ID (28)
    const [res1, res2] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: id1, range: `${tabName1}!A2:AC` }),
      sheets.spreadsheets.values.get({ spreadsheetId: id2, range: `${tabName2}!A2:AC` })
    ]);

    const rows1 = res1.data.values || [];
    const rows2 = res2.data.values || [];
    
    // Process using the maximum row count
    const maxRows = Math.max(rows1.length, rows2.length);
    const differences: string[][] = [];

    for (let i = 0; i < maxRows; i++) {
        const r1 = rows1[i] || [];
        const r2 = rows2[i] || [];
        
        const txt1 = (r1[0] || "").toString();
        const txt2 = (r2[0] || "").toString();
        const geo1 = (r1[28] || "").toString();
        const geo2 = (r2[28] || "").toString();
        
        const slug1 = extractPhotoSlug(txt1);
        const slug2 = extractPhotoSlug(txt2);
        
        const clean1 = cleanListingText(txt1);
        const clean2 = cleanListingText(txt2);

        // CASE 1: Identical content (after stripping status) -> IGNORE
        if (clean1 === clean2) continue;

        // CASE 2: Fuzzy Identical (status stripped, 98% match) -> IGNORE
        const sig1 = getSignificantLines(txt1);
        const sig2 = getSignificantLines(txt2);
        
        let matchRatio = 0;
        if (sig1.length > 0) {
            const matches = sig1.filter(line => clean2.includes(line)).length;
            matchRatio = matches / sig1.length;
        }

        if (matchRatio >= 0.98) continue;

        // CASE 3: Photo Match but Text Different -> COLLECT with Note
        if (slug1 && slug2 && slug1 === slug2) {
            differences.push([
                (i + 2).toString(),
                geo1,
                geo2,
                txt1,
                txt2,
                "FOR MANUAL CHECKING (Photo Match, Text Diff)"
            ]);
            continue;
        }

        // CASE 4: Total Difference -> COLLECT
        differences.push([
            (i + 2).toString(),
            geo1,
            geo2,
            txt1,
            txt2,
            matchRatio >= 0.8 ? "FOR MANUAL CHECKING (Fuzzy Match 80%+)" : "DIFFERENT CONTENT"
        ]);
    }

    if (differences.length === 0) {
        return NextResponse.json({ success: true, diffCount: 0, message: "Sheets are identical (ignoring status)!" });
    }

    // 2. Create new tab on GSheet 2
    const tabName = `Comparison - ${new Date().toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    })}`;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id2,
        requestBody: {
            requests: [{ addSheet: { properties: { title: tabName } } }]
        }
    });

    const header = ["Row #", "GEO ID (G1)", "GEO ID (G2)", "Col A (Gsheet1)", "Col A (Gsheet2)", "Notes"];
    await sheets.spreadsheets.values.update({
        spreadsheetId: id2,
        range: `${tabName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header, ...differences] }
    });

    // Formatting: Bold header and freeze
    const metaResponse = await sheets.spreadsheets.get({ spreadsheetId: id2 });
    const sheet = metaResponse.data.sheets?.find(s => s.properties?.title === tabName);
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: id2,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                            cell: { userEnteredFormat: { textFormat: { bold: true } } },
                            fields: "userEnteredFormat.textFormat.bold"
                        }
                    },
                    {
                        updateSheetProperties: {
                            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                            fields: "gridProperties.frozenRowCount"
                        }
                    }
                ]
            }
        });
    }

    return NextResponse.json({
        success: true,
        diffCount: differences.length,
        tabName,
        outputUrl: `https://docs.google.com/spreadsheets/d/${id2}`
    });

  } catch (err: any) {
    console.error("Comparison error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

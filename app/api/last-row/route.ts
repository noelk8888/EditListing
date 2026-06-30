import { NextRequest, NextResponse } from "next/server";
import { getSheets, getSheetTabNameByGid } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/last-row?spreadsheetId=...&gid=...
 * Returns the last row number that has data in column A.
 */
async function getLastRowWithData(spreadsheetId: string, tabName: string): Promise<number> {
  const sheets = getSheets();
  // Fetch all of column A to find the last non-empty row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
    majorDimension: "COLUMNS",
  });

  const colA = res.data.values?.[0] || [];
  // Walk backwards to find last non-empty cell
  let lastRow = 0;
  for (let i = colA.length - 1; i >= 0; i--) {
    if (colA[i] && colA[i].trim() !== "") {
      lastRow = i + 1; // 1-indexed
      break;
    }
  }
  return lastRow;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const masterSheetId = searchParams.get("masterSheetId");
    const luxeSheetId = searchParams.get("luxeSheetId");
    const gid = searchParams.get("gid");

    if (!masterSheetId || !luxeSheetId) {
      return NextResponse.json(
        { error: "masterSheetId and luxeSheetId are required" },
        { status: 400 }
      );
    }

    // Resolve tab name from gid (same gid for both sheets)
    let tabName = "Sheet1";
    if (gid) {
      const gidNum = parseInt(gid, 10);
      if (!isNaN(gidNum)) {
        const resolved = await getSheetTabNameByGid(masterSheetId, gidNum);
        if (resolved) tabName = resolved;
      }
    }

    const [masterLastRow, luxeLastRow] = await Promise.all([
      getLastRowWithData(masterSheetId, tabName),
      getLastRowWithData(luxeSheetId, tabName),
    ]);

    return NextResponse.json({
      masterLastRow,
      luxeLastRow,
      tabName,
      suggestedStartRow: masterLastRow > luxeLastRow ? luxeLastRow + 1 : null,
    });
  } catch (error) {
    console.error("last-row error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch last rows" },
      { status: 500 }
    );
  }
}

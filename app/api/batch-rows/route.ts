import { NextRequest, NextResponse } from "next/server";
import { getRowRange } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startRow = parseInt(searchParams.get("startRow") ?? "", 10);
    const endRow = parseInt(searchParams.get("endRow") ?? "", 10);
    const sheetUrl = searchParams.get("sheetUrl") ?? "";

    if (isNaN(startRow) || isNaN(endRow)) {
      return NextResponse.json(
        { error: "startRow and endRow are required numeric parameters" },
        { status: 400 }
      );
    }

    let spreadsheetId: string | undefined;
    if (sheetUrl) {
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
      }
      spreadsheetId = match[1];
    }

    const rows = await getRowRange(startRow, endRow, spreadsheetId);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("batch-rows error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rows" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getRowRange } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startRow = parseInt(searchParams.get("startRow") ?? "", 10);
    const endRow   = parseInt(searchParams.get("endRow")   ?? "", 10);

    if (isNaN(startRow) || isNaN(endRow)) {
      return NextResponse.json(
        { error: "startRow and endRow are required numeric parameters" },
        { status: 400 }
      );
    }

    const rows = await getRowRange(startRow, endRow);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("batch-rows error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rows" },
      { status: 500 }
    );
  }
}

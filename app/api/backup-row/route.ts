import { NextRequest, NextResponse } from "next/server";
import { getDisplayDataFromSheet } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const geoId = searchParams.get("geoId") ?? "";

    if (!geoId) {
      return NextResponse.json({ error: "geoId is required" }, { status: 400 });
    }

    const backupId = process.env.BACKUP_SPREADSHEET_ID;
    if (!backupId) {
      return NextResponse.json({ found: false, reason: "not-configured" });
    }

    const result = await getDisplayDataFromSheet(geoId, backupId);
    if (!result) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, data: result.data });
  } catch (error) {
    console.error("backup-row error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch backup row" },
      { status: 500 }
    );
  }
}

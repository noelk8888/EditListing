import { NextResponse } from "next/server";
import { findRowByGeoIdInSheet } from "@/lib/google-sheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const geoId = searchParams.get("geoId");
  const spreadsheetUrl = searchParams.get("spreadsheetUrl");

  if (!geoId || !spreadsheetUrl) {
    return NextResponse.json({ error: "Missing geoId or spreadsheetUrl" }, { status: 400 });
  }

  // Extract ID if a full URL was provided
  const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = match ? match[1] : spreadsheetUrl;

  try {
    const rowNumber = await findRowByGeoIdInSheet(geoId, spreadsheetId);
    return NextResponse.json({ rowNumber });
  } catch (error) {
    console.error("check-batch-row error:", error);
    return NextResponse.json({ error: "Failed to fetch row number" }, { status: 500 });
  }
}

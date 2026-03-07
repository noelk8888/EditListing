import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuth } from "@/lib/google-sheets";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_NAME = "Sheet1";

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Read AC (GEO ID col), AA (MAIN col, first line = GEO ID), A (old listings, first line = GEO ID)
    const [acRes, aaRes, aRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range: `${SHEET_NAME}!AC2:AC` }),
      sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range: `${SHEET_NAME}!AA2:AA` }),
      sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range: `${SHEET_NAME}!A2:A` }),
    ]);

    const GEO_RE = /^([A-Z])(\d{4,5})$/;
    const seen = new Set<string>();
    const geoIds: { id: string; num: number }[] = [];

    const addId = (raw: string) => {
      const s = raw.trim();
      const match = s.match(GEO_RE);
      if (match && !seen.has(s.toUpperCase())) {
        seen.add(s.toUpperCase());
        geoIds.push({ id: s.toUpperCase(), num: parseInt(match[2], 10) });
      }
    };

    for (const row of (acRes.data.values || [])) { if (row[0]) addId(row[0]); }
    for (const row of (aaRes.data.values || [])) { const fl = (row[0] || "").split("\n")[0]; if (fl) addId(fl); }
    for (const row of (aRes.data.values  || [])) { const fl = (row[0] || "").split("\n")[0]; if (fl) addId(fl); }

    // Sort by number descending
    geoIds.sort((a, b) => b.num - a.num);

    // Get top 10
    const top10 = geoIds.slice(0, 10);

    return NextResponse.json({
      totalCount: geoIds.length,
      top10: top10,
      nextGeoId: `G${top10[0].num + 1}`,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_NAME = "Sheet1";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error("Google service account credentials not configured");
  }

  // Handle JSON-encoded key (e.g. wrapped in quotes)
  try {
    privateKey = JSON.parse(privateKey);
  } catch {
    // Not JSON-encoded, use as-is
  }

  // Replace literal \n with actual newlines
  privateKey = (privateKey as string).replace(/\\n/g, "\n");

  return new JWT({ email, key: privateKey, scopes: SCOPES });
}

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Read all GEO IDs from column AC
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId!,
      range: `${SHEET_NAME}!AC2:AC`,
    });

    const idColumn = response.data.values || [];

    // Extract all valid GEO IDs with their numbers
    const geoIds: { id: string; num: number }[] = [];

    for (const row of idColumn) {
      const geoId = row[0];
      if (!geoId) continue;

      const match = geoId.match(/^([A-Z]+)(\d+)$/i);
      if (match) {
        geoIds.push({
          id: geoId,
          num: parseInt(match[2], 10),
        });
      }
    }

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

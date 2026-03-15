import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId") || "1yZBEpaO_NE4fUFOVhgoSEfC-UxyephQgs3C6hX5cM2k";
  const rowNumber = parseInt(searchParams.get("rowNumber") || "57", 10);
  const geoId = searchParams.get("geoId") || "TEST_WRITEBACK";

  const log: string[] = [];

  try {
    // 1. Check env vars
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    log.push(`service_account_email: ${email}`);
    log.push(`private_key_starts_with: ${rawKey?.replace(/\\n/g, "\n").split("\n")[1]?.substring(0, 20)}...`);

    if (!email || !rawKey) {
      return NextResponse.json({ ok: false, log, error: "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY" });
    }

    const privateKey = rawKey.replace(/\\n/g, "\n");

    const auth2 = new JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth: auth2 });

    // 2. Get spreadsheet metadata
    log.push(`fetching metadata for spreadsheet: ${spreadsheetId}`);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabNames = meta.data.sheets?.map((s: any) => s.properties?.title) ?? [];
    log.push(`tabs found: ${tabNames.join(", ")}`);

    // 3. Find MAIN tab
    const mainTab = meta.data.sheets?.find((s: any) => s.properties?.title === "MAIN");
    const sheetTabName = mainTab ? "MAIN" : (tabNames[0] || "Sheet1");
    log.push(`target tab: ${sheetTabName}`);

    // 4. Write to AC{rowNumber}
    const range = `${sheetTabName}!AC${rowNumber}`;
    log.push(`writing "${geoId}" to range: ${range}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[geoId]] },
    });

    log.push(`SUCCESS — wrote "${geoId}" to ${sheetTabName}!AC${rowNumber}`);

    return NextResponse.json({ ok: true, log, range, geoId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`ERROR: ${msg}`);
    return NextResponse.json({ ok: false, log, error: msg }, { status: 500 });
  }
}

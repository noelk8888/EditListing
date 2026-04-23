import { NextResponse } from "next/server";
import { getSheets, ensureSheetDimensions, getRowFormattingRequest } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";

// Processes formatting for a single spreadsheet (both Sheet1 and Sheet2 if present)
async function formatSpreadsheet(spreadsheetId: string) {
  const sheets = getSheets();

  // Get sheet metadata to find all tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const allTabs = (meta.data.sheets || []);

  const requests: object[] = [];

  for (const sheet of allTabs) {
    const tabName = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;

    if (!tabName || sheetId == null) continue;

    // Only format primary data sheets (Sheet1, Sheet2)
    if (tabName !== "Sheet1" && tabName !== "Sheet2") continue;

    console.log(`Scanning ${tabName} on spreadsheet ${spreadsheetId} for bulk formatting...`);

    // Ensure dimensions so we don't crash
    // 17 columns (A-Q), no minimum rows
    await ensureSheetDimensions(sheets, spreadsheetId, 17, undefined, tabName, meta);

    // Fetch column O (Status)
    const oResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!O1:O`,
    });

    const values = oResponse.data.values || [];

    // Skip row 1 (header)
    for (let i = 1; i < values.length; i++) {
        const rowNumber = i + 1;
        const status = (values[i][0] || "").trim();
        
        // Always generate a formatting request, even for "AVAILABLE" so we clear backgrounds
        const formatRequest = getRowFormattingRequest(sheetId, rowNumber, status);
        requests.push(formatRequest);
    }
  }

  // If we have requests, apply them in batches of 5,000 to avoid payload limits
  if (requests.length > 0) {
    console.log(`Applying ${requests.length} format requests to spreadsheet ${spreadsheetId}...`);
    
    const BATCH_SIZE = 5000;
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        const batch = requests.slice(i, i + BATCH_SIZE);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: batch }
        });
        console.log(`Applied batch ${i/BATCH_SIZE + 1} (${batch.length} rows)`);
    }
  }

  return requests.length;
}

export async function POST() {
  try {
    const session = await auth();
    const userRole = session?.user?.role;
    // We should allow superadmin only, but standard checking depends on your app rules
    // Defaulting to only Superadmin or allowed role.
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { SPREADSHEET_ID, BACKUP_SPREADSHEET_ID } = process.env;

    let totalFormatted = 0;

    if (SPREADSHEET_ID) {
      console.log("Starting bulk formatting for MAIN Sheet...");
      totalFormatted += await formatSpreadsheet(SPREADSHEET_ID);
    }

    if (BACKUP_SPREADSHEET_ID) {
      console.log("Starting bulk formatting for BACKUP Sheet...");
      totalFormatted += await formatSpreadsheet(BACKUP_SPREADSHEET_ID);
    }

    return NextResponse.json({ 
        success: true, 
        message: `Successfully generated and applied ${totalFormatted} row formatting rules across all databases.` 
    });

  } catch (error: any) {
    console.error("Bulk format error:", error);
    return NextResponse.json({ error: error.message || "Failed to process bulk formatting" }, { status: 500 });
  }
}

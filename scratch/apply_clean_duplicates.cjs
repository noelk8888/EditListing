const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!email || !rawKey || !spreadsheetId || !supabaseUrl || !supabaseKey) {
  console.error("Missing credentials, SPREADSHEET_ID, or SUPABASE config in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function cleanPrivateKey(raw) {
  const BEGIN = "-----BEGIN PRIVATE KEY-----";
  const END = "-----END PRIVATE KEY-----";
  let key = raw.trim();
  for (let i = 0; i < 3; i++) {
    if (key.startsWith('"') && key.endsWith('"')) {
      try { key = JSON.parse(key); } catch { key = key.slice(1, -1); }
    }
    if (key.startsWith("'") && key.endsWith("'")) {
      key = key.slice(1, -1);
    }
  }
  key = key.replace(/\\n/g, "\n");
  let body;
  const beginIdx = key.indexOf(BEGIN);
  const endIdx = key.indexOf(END);
  if (beginIdx !== -1 && endIdx !== -1) {
    body = key.substring(beginIdx + BEGIN.length, endIdx);
  } else {
    body = key;
  }
  body = body.replace(/[\s\r\n]+/g, "");
  const lines = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64));
  }
  return `${BEGIN}\n${lines.join("\n")}\n${END}\n`;
}

const privateKey = cleanPrivateKey(rawKey);

const targetRows = [3732, 4759, 7519, 9040, 9819, 10099, 10155, 10456, 10583, 11646];

function cleanText(text) {
  const lines = text.split("\n");
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (i < 3 && upper.includes("DUPLICATE") && !upper.includes("ROW")) {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n");
}

async function run() {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log("Starting cleanup process for 10 rows...");
  
  const gsheetUpdates = [];

  for (const rowNum of targetRows) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'Sheet1'!A${rowNum}:AC${rowNum}`
    });

    const rowData = response.data.values?.[0] || [];
    const colA = rowData[0] || "";
    const colAA = rowData[26] || "";
    const geoId = (rowData[28] || "").trim();

    const cleanedA = cleanText(colA);
    const cleanedAA = cleanText(colAA);

    // Stage GSheet updates
    gsheetUpdates.push(
      { range: `Sheet1!A${rowNum}`, values: [[cleanedA]] },
      { range: `Sheet1!AA${rowNum}`, values: [[cleanedAA]] }
    );

    console.log(`\nProcessing Row ${rowNum} (GEO ID: ${geoId || "None"}):`);

    // Update Supabase if GEO ID exists
    if (geoId && geoId !== "N/A" && geoId !== "PENDING") {
      console.log(`  Updating Supabase MAIN for GEO ID: "${geoId}"...`);
      const { data, error } = await supabase
        .from('KIU Properties')
        .update({ MAIN: cleanedAA })
        .eq('GEO ID', geoId);

      if (error) {
        console.error(`  ❌ Supabase update failed for ${geoId}:`, error.message);
      } else {
        console.log(`  ✅ Supabase updated successfully.`);
      }
    } else {
      console.log("  ⚠️ Skipping Supabase update (no valid GEO ID found).");
    }
  }

  // Execute GSheet batch updates
  console.log("\nExecuting Google Sheets batch update...");
  const updateRes = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: gsheetUpdates,
    },
  });

  console.log(`✅ Google Sheets batch update complete. Updated ${gsheetUpdates.length} cells.`);
  console.log("\n=== Cleanup Process Complete ===");
}

run().catch(console.error);

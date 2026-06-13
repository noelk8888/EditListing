const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

if (!email || !rawKey || !spreadsheetId) {
  console.error("Missing credentials or SPREADSHEET_ID in .env.local");
  process.exit(1);
}

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

async function run() {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log("Fetching columns A (blastedFormat), AA (main), AC (GEO ID) from Sheet1...");
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["'Sheet1'!A2:A", "'Sheet1'!AA2:AA", "'Sheet1'!AC2:AC"]
  });

  const valueRanges = response.data.valueRanges || [];
  const colAValues = valueRanges[0]?.values || [];
  const colAAValues = valueRanges[1]?.values || [];
  const colACValues = valueRanges[2]?.values || [];

  const maxRows = Math.max(colAValues.length, colAAValues.length, colACValues.length);
  console.log(`Scanned ${maxRows} rows in Sheet1.`);

  let matchCount = 0;
  console.log("\n=== ROWS WITH MULTIPLE DUPLICATE TAGS ===");

  for (let idx = 0; idx < maxRows; idx++) {
    const rowNumber = idx + 2;
    const colA = colAValues[idx]?.[0] || "";
    const colAA = colAAValues[idx]?.[0] || "";
    const geoId = colACValues[idx]?.[0] || "N/A";

    const aDupLines = colA.split("\n").filter(line => line.toUpperCase().includes("DUPLICATE"));
    const aaDupLines = colAA.split("\n").filter(line => line.toUpperCase().includes("DUPLICATE"));

    if (aDupLines.length >= 2 || aaDupLines.length >= 2) {
      matchCount++;
      console.log(`\nRow ${rowNumber} [GEO ID: ${geoId}]:`);
      if (aDupLines.length >= 2) {
        console.log(`  Col A duplicate lines:`);
        aDupLines.forEach(l => console.log(`    - ${l.trim()}`));
      }
      if (aaDupLines.length >= 2) {
        console.log(`  Col AA duplicate lines:`);
        aaDupLines.forEach(l => console.log(`    - ${l.trim()}`));
      }
    }
  }

  console.log(`\n=== Total rows with 2 or more duplicate lines: ${matchCount} ===`);
}

run().catch(console.error);

const { google } = require('googleapis');
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

const targetRows = [3732, 4759, 7519, 9040, 9819, 10099, 10155, 10456, 10583, 11646];

function cleanText(text) {
  const lines = text.split("\n");
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    // In first 3 lines, remove duplicate tags that don't say DUPLICATE ROW
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

  console.log("Fetching rows to compare...");
  
  for (const rowNum of targetRows) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'Sheet1'!A${rowNum}:AA${rowNum}`
    });

    const rowData = response.data.values?.[0] || [];
    const colA = rowData[0] || "";
    const colAA = rowData[26] || "";

    const cleanedA = cleanText(colA);
    const cleanedAA = cleanText(colAA);

    console.log(`\n==================================================`);
    console.log(`ROW ${rowNum} Projections`);
    console.log(`==================================================`);
    
    console.log(`--- COLUMN A (Original) ---`);
    console.log(colA.split("\n").slice(0, 4).map(l => `  ${l}`).join("\n") + "\n  ...");
    
    console.log(`\n--- COLUMN A (Proposed Cleaned) ---`);
    console.log(cleanedA.split("\n").slice(0, 3).map(l => `  ${l}`).join("\n") + "\n  ...");

    console.log(`\n--- COLUMN AA (Original) ---`);
    console.log(colAA.split("\n").slice(0, 4).map(l => `  ${l}`).join("\n") + "\n  ...");

    console.log(`\n--- COLUMN AA (Proposed Cleaned) ---`);
    console.log(cleanedAA.split("\n").slice(0, 3).map(l => `  ${l}`).join("\n") + "\n  ...");
  }
}

run().catch(console.error);

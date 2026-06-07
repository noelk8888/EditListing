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

async function run() {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  console.log('Fetching all GEO IDs from Sheet1!AC2:AC...');
  const acResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!AC2:AC',
  });

  const values = acResp.data.values || [];
  console.log(`Fetched ${values.length} rows.`);

  const geoIdMap = new Map();
  values.forEach((row, index) => {
    const geoId = (row[0] || '').toString().trim().toUpperCase();
    if (geoId) {
      const rowNum = index + 2;
      const list = geoIdMap.get(geoId) || [];
      list.push(rowNum);
      geoIdMap.set(geoId, list);
    }
  });

  const duplicates = [];
  geoIdMap.forEach((rows, geoId) => {
    // Only flag actual duplicate groups (rows sharing same GEO ID)
    // Ignore already suffixed duplicates like -D or -D-D etc if they are unique
    if (rows.length > 1) {
      duplicates.push({ geoId, rows });
    }
  });

  console.log(`\n=== FOUND ${duplicates.length} SHARED GEO ID GROUPS ===`);
  duplicates.forEach((group, index) => {
    console.log(`${index + 1}. GEO ID: ${group.geoId} -> Rows: ${group.rows.join(', ')}`);
  });
}

run().catch(console.error);

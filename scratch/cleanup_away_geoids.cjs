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

const GEO_ID_RE = /^[A-Z]\d{4,6}(?:-D)*$/i;

function isGeoId(val) {
  if (!val) return false;
  return GEO_ID_RE.test(val.trim());
}

async function cleanSheetTab(sheets, tabName) {
  console.log(`\n--- Cleaning Tab: ${tabName} ---`);
  
  // Batch get columns L (index 11) and BA (index 52)
  const ranges = [`${tabName}!L2:L`, `${tabName}!BA2:BA`];
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges
  });

  const valueRanges = response.data.valueRanges || [];
  const colLValues = valueRanges[0]?.values || [];
  const colBAValues = valueRanges[1]?.values || [];

  let lModified = false;
  let baModified = false;

  const newColL = colLValues.map((row, idx) => {
    const val = (row[0] || '').toString();
    if (isGeoId(val)) {
      console.log(`Row ${idx + 2} Col L: Found GEO ID "${val}". Clearing...`);
      lModified = true;
      return [''];
    }
    return [val];
  });

  const newColBA = colBAValues.map((row, idx) => {
    const val = (row[0] || '').toString();
    if (isGeoId(val)) {
      console.log(`Row ${idx + 2} Col BA: Found GEO ID "${val}". Clearing...`);
      baModified = true;
      return [''];
    }
    return [val];
  });

  if (lModified && newColL.length > 0) {
    console.log(`Writing back cleaned Column L to ${tabName}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!L2:L${newColL.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newColL }
    });
  } else {
    console.log(`Column L in ${tabName} is already clean.`);
  }

  if (baModified && newColBA.length > 0) {
    console.log(`Writing back cleaned Column BA to ${tabName}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!BA2:BA${newColBA.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newColBA }
    });
  } else {
    console.log(`Column BA in ${tabName} is already clean.`);
  }
}

async function cleanSupabase() {
  console.log('\n--- Cleaning Supabase KIU Properties ---');
  
  let allRecords = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: records, error } = await supabase
      .from('KIU Properties')
      .select('"GEO ID", "AWAY"')
      .not('AWAY', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching from Supabase:", error);
      break;
    }
    if (!records || records.length === 0) break;
    allRecords = allRecords.concat(records);
    if (records.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`Fetched ${allRecords.length} records with non-null AWAY values in total.`);

  let clearedCount = 0;
  for (const rec of allRecords) {
    const awayVal = rec.AWAY;
    if (isGeoId(awayVal)) {
      console.log(`Supabase GEO ID "${rec['GEO ID']}": Found invalid AWAY "${awayVal}". Resetting to null...`);
      const { error: updateErr } = await supabase
        .from('KIU Properties')
        .update({ "AWAY": null })
        .eq('GEO ID', rec['GEO ID']);

      if (updateErr) {
        console.error(`Failed to update ${rec['GEO ID']} in Supabase:`, updateErr.message);
      } else {
        clearedCount++;
      }
    }
  }

  console.log(`Successfully cleared ${clearedCount} records in Supabase.`);
}

async function run() {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Clean Google Sheets
  await cleanSheetTab(sheets, 'Sheet1');
  await cleanSheetTab(sheets, 'Sheet2');

  // Clean Supabase
  await cleanSupabase();

  console.log('\n=== Cleanup Complete ===');
}

run().catch(console.error);

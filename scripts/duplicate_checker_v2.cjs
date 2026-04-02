require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration from .env.local
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

function cleanPrivateKey(raw) {
  const BEGIN = "-----BEGIN PRIVATE KEY-----";
  const END = "-----END PRIVATE KEY-----";
  if (!raw) return null;
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

const PRIVATE_KEY = cleanPrivateKey(RAW_PRIVATE_KEY);

const SOURCE_SPREADSHEET_ID = '12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0';
const TARGET_SPREADSHEET_ID = '12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0';
const SOURCE_RANGE = 'Sheet1!A2:AC'; // Read up to GEO ID (Col AC)

// Mapping from lib/google-sheets.ts logic
const COL_A_BLASTED_FORMAT = 0;
const COL_AB_PHOTO = 27;
const COL_AC_GEO_ID = 28;

function normalize(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // remove all non-alphanumeric
    .trim();
}

async function runChecker() {
  console.log('--- DUPLICATE CHECKER v2 START ---');
  
  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    console.error('ERROR: Missing credentials in .env.local');
    return;
  }

  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  console.log('Authorizing...');
  await auth.authorize();
  console.log('Authorized successfully.');

  const sheets = google.sheets({ version: 'v4' });

  try {
    console.log(`Reading source sheet: ${SOURCE_SPREADSHEET_ID}...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SOURCE_SPREADSHEET_ID,
      range: SOURCE_RANGE,
      auth,
    });

    const rows = response.data.values || [];
    console.log(`Read ${rows.length} rows.`);

    const photoGroups = new Map(); // key -> [rows]
    const fuzzyGroups = new Map(); // key -> [rows]

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const blastedFormat = row[COL_A_BLASTED_FORMAT] || '';
      const photoLink = (row[COL_AB_PHOTO] || '').trim();
      const geoId = row[COL_AC_GEO_ID] || '';

      const data = { rowNum, geoId, blastedFormat, photoLink };

      if (photoLink && photoLink.length > 5 && !photoLink.toLowerCase().includes('placeholder')) {
        // Group by Photo Link
        if (!photoGroups.has(photoLink)) photoGroups.set(photoLink, []);
        photoGroups.get(photoLink).push(data);
      } else {
        // Group by Fuzzy Content
        const normalized = normalize(blastedFormat);
        if (normalized.length > 20) { // arbitrary threshold to avoid matching "TBA" or empty strings
          if (!fuzzyGroups.has(normalized)) fuzzyGroups.set(normalized, []);
          fuzzyGroups.get(normalized).push(data);
        }
      }
    });

    const finalDuplicates = [];

    // Process Photo Duplicates
    for (const [link, matches] of photoGroups.entries()) {
      if (matches.length > 1) {
        finalDuplicates.push({
          geoIds: matches.map(m => m.geoId).filter(Boolean).join(', '),
          rowNumbers: matches.map(m => m.rowNum).join(', '),
          sampleFormat: matches[0].blastedFormat,
          reason: 'Photo Match'
        });
      }
    }

    // Process Fuzzy Duplicates
    for (const [norm, matches] of fuzzyGroups.entries()) {
      if (matches.length > 1) {
        finalDuplicates.push({
          geoIds: matches.map(m => m.geoId).filter(Boolean).join(', '),
          rowNumbers: matches.map(m => m.rowNum).join(', '),
          sampleFormat: matches[0].blastedFormat,
          reason: 'Fuzzy Content Match'
        });
      }
    }

    console.log(`Found ${finalDuplicates.length} duplicate groups.`);

    if (finalDuplicates.length === 0) {
      console.log('No duplicates found based on criteria.');
      return;
    }

    // Prepare for output
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/:/g, '-');
    const newTabName = `Duplicates_${timestamp}`;

    console.log(`Creating new tab "${newTabName}" in target sheet...`);
    
    // 1. Add Sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      auth,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: newTabName,
              },
            },
          },
        ],
      },
    });

    // 2. Write Data
    const header = ['GEO ID(s)', 'Row Numbers', 'Sample Format', 'Matching Reason'];
    const dataRows = finalDuplicates.map(d => [d.geoIds, d.rowNumbers, d.sampleFormat, d.reason]);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      range: `${newTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      auth,
      requestBody: {
        values: [header, ...dataRows],
      },
    });

    console.log('--- DUPLICATE CHECKER v2 DONE ---');
    console.log(`Results exported to: https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}`);

  } catch (err) {
    console.error('Error during execution:', err);
  }
}

runChecker();

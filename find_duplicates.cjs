
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load credentials from service-account.json
const creds = JSON.parse(fs.readFileSync('/Users/noelk/repos/LUXE Edit/luxe-listings/service-account.json', 'utf-8'));

async function findDuplicates() {
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0';
  const range = 'Sheet1!AC2:AC'; // GEO ID column

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const geoIdMap = new Map();
    const duplicates = [];

    rows.forEach((row, index) => {
      const geoId = row[0];
      if (geoId && geoId.trim()) {
        const rowNumber = index + 2; // +2 for header and 0-indexing
        if (geoIdMap.has(geoId)) {
          geoIdMap.get(geoId).push(rowNumber);
        } else {
          geoIdMap.set(geoId, [rowNumber]);
        }
      }
    });

    for (const [geoId, rowNumbers] of geoIdMap.entries()) {
      if (rowNumbers.length > 1) {
        duplicates.push({ geoId, rowNumbers });
      }
    }

    if (duplicates.length > 0) {
      console.log('--- Duplicate GEO IDs Found ---');
      duplicates.forEach(d => {
        console.log(`${d.geoId}: Rows ${d.rowNumbers.join(', ')}`);
      });
    } else {
      console.log('No duplicate GEO IDs found.');
    }
  } catch (err) {
    console.error('Error searching for duplicates:', err.message);
  }
}

findDuplicates();

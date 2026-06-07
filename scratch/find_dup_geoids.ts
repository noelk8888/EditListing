import { getSheets } from '../lib/google-sheets';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  console.log('Fetching all GEO IDs from column AC (index 28)...');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!AC2:AC',
  });

  const values = response.data.values || [];
  console.log(`Successfully fetched ${values.length} rows.`);

  const geoIdMap = new Map<string, number[]>();
  
  values.forEach((row, index) => {
    const geoId = (row[0] || '').toString().trim();
    if (geoId) {
      const rowNum = index + 2; // Row numbers are 1-based, data starts on row 2
      const list = geoIdMap.get(geoId) || [];
      list.push(rowNum);
      geoIdMap.set(geoId, list);
    }
  });

  const duplicates: { geoId: string; rows: number[] }[] = [];
  geoIdMap.forEach((rows, geoId) => {
    if (rows.length > 1) {
      duplicates.push({ geoId, rows });
    }
  });

  console.log(`\n=== FOUND ${duplicates.length} GEO ID COLLISION GROUPS ===`);
  duplicates.forEach((group, index) => {
    console.log(`${index + 1}. GEO ID: ${group.geoId} -> Rows: ${group.rows.join(', ')}`);
  });
}

run().catch(console.error);

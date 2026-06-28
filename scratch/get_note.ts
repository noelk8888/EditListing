import { config } from 'dotenv';
config({ path: '.env.local' });
import { google } from 'googleapis';
import { getAuth } from '../lib/google-sheets';

async function run() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!AC:AC"
  });
  
  const values = response.data.values;
  let rowIdx = -1;
  if (values) {
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === 'G00454') {
        rowIdx = i;
        break;
      }
    }
  }
  
  if (rowIdx === -1) {
    console.log("Not found in Sheet1");
    return;
  }
  
  console.log("Row number:", rowIdx + 1);
  
  const rowDataRes = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`Sheet1!A${rowIdx + 1}:BW${rowIdx + 1}`],
    includeGridData: true
  });
  
  const rowData = rowDataRes.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || [];
  rowData.forEach((cell: any, idx: number) => {
    if (cell.note) {
      console.log(`Column ${idx} Note:`, cell.note);
    }
  });
}

run().catch(console.error);

import { config } from 'dotenv';
config({ path: '.env.local' });
import { google } from 'googleapis';
import { getAuth } from '../lib/google-sheets';

async function migrateSheet(sheetName: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  console.log(`Fetching AW and Q columns from ${sheetName}...`);
  const [awRes, qRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!AW:AW`
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!Q:Q`
    })
  ]);
  
  const awValues = awRes.data.values || [];
  const qValues = qRes.data.values || [];
  
  const targetLen = Math.max(awValues.length, qValues.length);
  if (targetLen === 0) {
    console.log(`No data in ${sheetName}.`);
    return;
  }
  
  const newValues = [];
  for (let i = 0; i < targetLen; i++) {
    // We want to copy everything including header. AW1 might be "Comments", which we'll copy to Q1.
    const awVal = (awValues[i] && awValues[i][0]) ? String(awValues[i][0]) : "";
    newValues.push([awVal]);
  }
  
  console.log(`Updating Q column in ${sheetName} with ${newValues.length} rows...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!Q1:Q${targetLen}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: newValues
    }
  });
  
  console.log(`${sheetName} migration complete!`);
}

async function run() {
  try {
    await migrateSheet("Sheet1");
  } catch (e) {
    console.log("Error on Sheet1:", e);
  }
  try {
    await migrateSheet("Sheet2");
  } catch (e) {
    console.log("Error on Sheet2:", e);
  }
  console.log("All done!");
}

run().catch(console.error);

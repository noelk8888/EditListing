import { config } from "dotenv";
config({ path: ".env.local" });
import { getSheets } from "./lib/google-sheets";
async function run() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Sheet1!AC105:AC107"
  });
  console.log("AC105-107:", JSON.stringify(res.data.values));
}
run();

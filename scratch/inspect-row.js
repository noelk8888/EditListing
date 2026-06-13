const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

const credentialsPath = path.join(process.cwd(), "service-account.json");
let authClient;
if (fs.existsSync(credentialsPath)) {
  const creds = JSON.parse(fs.readFileSync(credentialsPath));
  authClient = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== SHEET ROW 4232 INSPECTION ===");
  if (authClient) {
    const sheets = google.sheets({ version: "v4", auth: authClient });
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A4232:BO4232",
      });
      const row = res.data.values?.[0] || [];
      console.log("Sheet1 Row 4232:");
      console.log("  Col A (blastedFormat):", row[0]);
      console.log("  Col B (type):", row[1]);
      console.log("  Col D (city):", row[3]);
      console.log("  Col G (price):", row[6]);
      console.log("  Col AA (main):", row[26]);
      console.log("  Col AC (geoId):", row[28]);
      
      const geoId = row[28];
      if (geoId) {
        console.log(`Searching Supabase for GEO ID: ${geoId}`);
        const { data: recordsByGeo, error: errByGeo } = await supabase
          .from("KIU Properties")
          .select('"GEO ID", "MAIN", "STATUS", "SOURCE_TAB"')
          .eq("GEO ID", geoId);
        console.log("Supabase records by GEO ID:", recordsByGeo);
      }
    } catch (e) {
      console.error("Error reading from Sheet1:", e);
    }
  }

  console.log("\n=== SUPABASE TEXT SEARCH ===");
  const { data: records, error } = await supabase
    .from("KIU Properties")
    .select('"GEO ID", "MAIN", "STATUS", "SOURCE_TAB"')
    .ilike("MAIN", "%Terrazas de Alava%");

  if (error) {
    console.error("Error fetching records:", error);
    return;
  }

  console.log("Records found for %Terrazas de Alava%:", JSON.stringify(records, null, 2));
}

run();


import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = "KIU Properties";
const GEO_ID = "G07593";

async function syncListing() {
  console.log(`🚀 Starting manual sync for ${GEO_ID} using extracted data...`);

  // Data extracted via browser subagent
  const extractedData = {
    main: `G07593\n*FOR SALE*\nGalleria New Manila, 23 14th St., Brgy. Damayang Lagi, New Manila, Quezon City\nThree Storey Corner Townhouse\nInside Gated Compound\nLot Area: 117 sqm\nFloor Area: 320 sqm\n4 bedrooms with 3 T&B\nEntertainment Area\nWith option to rent additional parking slots\nPrice: P26,000,000 gross\nPhotos: https://photos.app.goo.gl/PTEJG3zYxJ5py83S6`,
    photo: "https://photos.app.goo.gl/PTEJG3zYxJ5py83S6",
    mapLink: "https://www.google.com/maps/place/23+14th+St,+Quezon+City,+Metro+Manila/@14.6191834,121.033621,17z/data=!3m1!4b1!4m6!3m5!1s0x3397b7de28d7a1e1:0x4e6d6f6e6f6e6f6e!8m2!3d14.6191834!4d121.033621!16s%2Fg%2F11b6_6j_7",
    region: "NCR",
    province: "Metro Manila",
    city: "Quezon City",
    barangay: "Damayang Lagi",
    area: "New Manila",
    building: "Galleria New Manila",
    residential: "RESIDENTIAL",
    lotArea: 117,
    floorArea: 320,
    price: 26000000,
    status: "AVAILABLE",
    type: "TOWNHOUSE",
    dateReceived: "2024-10-29",
    dateUpdated: "2025-02-12",
    sourceTab: "Sheet1"
  };

  const supabaseRecord = {
    "GEO ID": GEO_ID,
    "MAIN": extractedData.main,
    "PHOTO": extractedData.photo,
    "REGION": extractedData.region,
    "PROVINCE": extractedData.province,
    "CITY": extractedData.city,
    "BARANGAY": extractedData.barangay,
    "AREA": extractedData.area,
    "BUILDING": extractedData.building,
    "TYPE": extractedData.type,
    "STATUS": extractedData.status,
    "LOT AREA": extractedData.lotArea,
    "FLOOR AREA": extractedData.floorArea,
    "Extracted Sale Price": extractedData.price,
    "RESIDENTIAL": extractedData.residential,
    "DATE RECV": extractedData.dateReceived,
    "DATE UPDATED": extractedData.dateUpdated,
    "MAP LINK": extractedData.mapLink,
    "SOURCE_TAB": extractedData.sourceTab,
  };

  console.log(`📦 Upserting to Supabase...`);
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(supabaseRecord, { onConflict: 'GEO ID' })
    .select();

  if (error) {
    console.error(`❌ Supabase error:`, error);
  } else {
    console.log(`✅ Successfully synced ${GEO_ID} with hardcoded data.`);
  }
}

syncListing();

import { config } from "dotenv";
config({ path: ".env.local" });
import { getRowByRowNumber } from "./lib/google-sheets";

async function run() {
  const row10380 = await getRowByRowNumber(10380, "Sheet1");
  const row10646 = await getRowByRowNumber(10646, "Sheet1");
  
  console.log("Row 10380:", { geoId: row10380?.geoId, summary: row10380?.main, blasted: row10380?.blastedFormat });
  console.log("Row 10646:", { geoId: row10646?.geoId, summary: row10646?.main, blasted: row10646?.blastedFormat });
}
run();

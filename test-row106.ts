import { config } from "dotenv";
config({ path: ".env.local" });
import { getRowByRowNumber } from "./lib/google-sheets";
async function run() {
  const row = await getRowByRowNumber(106, "Sheet1");
  console.log("Col AC (geoId):", row?.geoId);
  console.log("Col A (blastedFormat):", JSON.stringify(row?.blastedFormat));
  console.log("Col AA (main):", JSON.stringify(row?.main));
}
run();

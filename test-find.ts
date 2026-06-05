import { config } from "dotenv";
config({ path: ".env.local" });
import { getRowByGeoId, findRowAndTabByGeoId } from "./lib/google-sheets";
async function run() {
  const row = await getRowByGeoId("G12197");
  const tabInfo = await findRowAndTabByGeoId("G12197");
  console.log("Matched Row (getRowByGeoId):", row?.rowNumber);
  console.log("Matched TabInfo:", JSON.stringify({ rowNumber: tabInfo?.rowNumber, tabName: tabInfo?.tabName }));
}
run();

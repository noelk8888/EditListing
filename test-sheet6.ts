import { config } from "dotenv";
config({ path: ".env.local" });
import { getRowByRowNumber } from "./lib/google-sheets";
async function run() {
  const row = await getRowByRowNumber(106, "Sheet6");
  console.log("Sheet6 Row 106 ID:", row?.geoId);
  console.log("Sheet6 Row 106 Summary:", row?.main);
}
run();

import { getRowByGeoId } from "./lib/google-sheets";
async function run() {
  const row = await getRowByGeoId("G12197");
  console.log("Row number:", row?.rowNumber);
}
run();

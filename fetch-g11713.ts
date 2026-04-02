import * as dotenv from "dotenv";
dotenv.config();
import { getRowByGeoId } from "./lib/google-sheets";

async function view() {
  try {
    const row = await getRowByGeoId("G11713");
    console.log(JSON.stringify(row, null, 2));
  } catch (e) {
    console.error(e);
  }
}
view();

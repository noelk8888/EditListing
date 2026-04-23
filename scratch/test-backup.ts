import { createSpreadsheetBackup } from "../lib/google-sheets";
import { config } from "dotenv";
config();
async function run() {
  try {
    console.log("Testing backup module...");
    const res = await createSpreadsheetBackup();
    console.log("Success:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}
run();

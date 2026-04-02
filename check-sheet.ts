import { findGeoIdSourceTab } from "./lib/google-sheets";

async function run() {
  try {
    const tab1 = await findGeoIdSourceTab("G11713", "Sheet1").catch(() => null);
    console.log("Found in Sheet1:", tab1);
  } catch(e) { console.error("Sheet1 err", e); }
  
  try {
    const tab2 = await findGeoIdSourceTab("G11713", "Sheet2").catch(() => null);
    console.log("Found in Sheet2:", tab2);
  } catch(e) { console.error("Sheet2 err", e); }
}

run();

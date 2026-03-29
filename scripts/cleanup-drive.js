const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const fs = require("fs");
const path = require("path");

const SCOPES = ["https://www.googleapis.com/auth/drive"];

async function cleanupDrive() {
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  let auth;

  if (fs.existsSync(serviceAccountPath)) {
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });
    console.log(`🧹 Cleaning up Drive for: ${credentials.client_email}`);
  } else {
    process.exit(1);
  }

  const drive = google.drive({ version: "v3", auth });

  // IDs to delete (found from research-drive.js)
  const idsToDelete = [
    "1t9STjXFOYMNdsGJy7BvhjuqpWIgKHkcetSVKGQuME_c", // LUXE COPY
    "1OYk_LGiLYb_ayGoVJ-tistDias2VdETdR60SP5ALBlo", // S1 GV CleanReference
    "1Wk-hWIPaQvtrbHvHE4miy4u16zzSar4BETBg1itj_Gg"  // LPK personal listings
  ];

  for (const id of idsToDelete) {
    try {
      console.log(`🗑️ Deleting file: ${id}...`);
      await drive.files.delete({ fileId: id });
    } catch (e) {
      console.warn(`  - Skip: ${id} (${e.message})`);
    }
  }

  try {
    console.log("\n🚮 Emptying Service Account's private trash...");
    await drive.files.emptyTrash();
    console.log("✅ Trash emptied.");
  } catch (e) {
    console.error("❌ Trash empty failed:", e.message);
  }
}

cleanupDrive();

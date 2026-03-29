import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SCOPES = ["https://www.googleapis.com/auth/drive"];

async function researchDrive() {
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  let auth;

  if (fs.existsSync(serviceAccountPath)) {
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });
    console.log(`🔍 Researching Drive for: ${credentials.client_email}`);
  } else {
    throw new Error("service-account.json not found");
  }

  const drive = google.drive({ version: "v3", auth });

  try {
    // 1. List all files owned by the Service Account (including trashed)
    console.log("\n--- Files in 'My Drive' (Owned by Service Account) ---");
    const res = await drive.files.list({
      pageSize: 100,
      fields: "files(id, name, size, mimeType, trashed, createdTime)",
      q: "owners.me = true",
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No files found.");
    } else {
      files.forEach(f => {
        const sizeKB = (parseInt(f.size || "0") / 1024).toFixed(2);
        console.log(`[${f.trashed ? "TRASHED" : "ACTIVE"}] ${f.name} (${sizeKB} KB) - ID: ${f.id}`);
      });
    }

    // 2. Check storage quota status
    console.log("\n--- Storage Quota Status ---");
    const about = await drive.about.get({
      fields: "storageQuota",
    });
    const quota = about.data.storageQuota;
    if (quota) {
      const limit = (parseInt(quota.limit || "0") / (1024 * 1024)).toFixed(2);
      const usage = (parseInt(quota.usage || "0") / (1024 * 1024)).toFixed(2);
      console.log(`Usage: ${usage} MB / Limit: ${limit} MB`);
    }

  } catch (err) {
    console.error("Error researching drive:", err);
  }
}

researchDrive();

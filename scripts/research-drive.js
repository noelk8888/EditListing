const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const fs = require("fs");
const path = require("path");

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
    console.error("❌ ERROR: service-account.json not found!");
    process.exit(1);
  }

  const drive = google.drive({ version: "v3", auth });

  try {
    // 1. Check storage quota status FIRST (often more reliable)
    console.log("\n--- Storage Quota Status ---");
    const about = await drive.about.get({
      fields: "storageQuota,user",
    });
    console.log(`User: ${about.data.user.displayName} (${about.data.user.emailAddress})`);
    const quota = about.data.storageQuota;
    if (quota) {
      const limitMB = (parseInt(quota.limit || "0") / (1024 * 1024)).toFixed(2);
      const usageMB = (parseInt(quota.usage || "0") / (1024 * 1024)).toFixed(2);
      console.log(`Usage: ${usageMB} MB / Limit: ${limitMB} MB`);
    }

    // 2. List files (using simplest query)
    console.log("\n--- Files Found ---");
    const res = await drive.files.list({
      pageSize: 50,
      fields: "files(id, name, size, trashed, createdTime)",
      // Remove complex 'q' for now
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No files found.");
    } else {
      files.forEach(f => {
        const sizeKB = (parseInt(f.size || "0") / 1024).toFixed(2);
        console.log(`[${f.trashed ? "TRASHED" : "ACTIVE"}] ${f.name} (${sizeKB} KB) - ID: ${f.id} - ${f.createdTime}`);
      });
    }

  } catch (err) {
    console.error("Error researching drive:", err.message);
    if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  }
}

researchDrive();

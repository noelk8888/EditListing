
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data, error } = await supabase
    .from("KIU Properties")
    .select('"GEO ID", "MAIN", "Extracted Sale Price"')
    .eq("GEO ID", "G07593")
    .single();

  if (error) {
    console.error("Verification failed:", error.message);
  } else {
    console.log("Record Found:");
    console.log("ID:", data["GEO ID"]);
    console.log("Price:", data["Extracted Sale Price"]);
    console.log("Main Snippet:", data["MAIN"].substring(0, 50));
  }
}

verify();

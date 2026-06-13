const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Key in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: records, error } = await supabase
    .from("KIU Properties")
    .select('"GEO ID", "MAIN", "STATUS", "SOURCE_TAB"')
    .ilike("GEO ID", "%00830%");

  if (error) {
    console.error("Error fetching records:", error);
    return;
  }

  console.log("Records found for %00830%:", JSON.stringify(records, null, 2));
}

check();

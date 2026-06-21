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
    .from("luxe_telegram_groups")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching records:", error);
    return;
  }

  console.log("Telegram groups from DB:");
  records.forEach(r => {
    console.log(`- name: "${r.name}", is_active: ${r.is_active}, chat_id: "${r.chat_id}"`);
  });
}

check();

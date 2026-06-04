const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const emails = ["sales@luxerealtyph.com", "iamnoel888@gmail.com"];
  console.log(`Checking database for emails...`);
  
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .in("email", emails.map(e => e.toLowerCase()));

  if (error) {
    console.error("Error querying Supabase:", error);
  } else {
    console.log("Records found:");
    console.log(JSON.stringify(data, null, 2));
  }
}

checkUsers();

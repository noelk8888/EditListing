const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("Fetching unique spearheaded_by values from luxe_listing_fb_groups...");
  const { data, error } = await supabase
    .from('luxe_listing_fb_groups')
    .select('spearheaded_by')
    .not('spearheaded_by', 'is', null)
    .not('spearheaded_by', 'eq', '');

  if (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }

  const names = data || [];
  const processedNames = names
    .map(item => item.spearheaded_by?.trim())
    .filter(name => !!name);
  
  const uniqueNames = Array.from(new Set(processedNames));
  console.log(`Found ${uniqueNames.length} unique ownership names.`);

  for (const name of uniqueNames) {
    console.log(`Inserting: ${name}`);
    const { error: insertError } = await supabase
      .from('luxe_listing_ownerships')
      .insert({ name })
      .select();

    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        console.log(`  -> Already exists, skipping.`);
      } else {
        console.error(`  -> Error inserting ${name}:`, insertError);
      }
    } else {
      console.log(`  -> Success.`);
    }
  }

  console.log("Migration complete.");
}

runMigration();

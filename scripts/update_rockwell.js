require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.from('luxe_telegram_groups')
    .select('*')
    .ilike('name', '%ROCKWELL%');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const additionalKeywords = [
    "Edades Tower",
    "Edades",
    "Proscenium" // Just to ensure it matches partial too
  ];
  
  for (const group of data) {
    if (group.name.includes("ROCKWELL LEASE") || group.name.includes("ROCKWELL SALE")) {
       let keywords = group.keywords || [];
       if (typeof keywords === 'string') {
        keywords = keywords.split(',').map(k => k.trim());
       }
       let merged = Array.from(new Set([...keywords, ...additionalKeywords]));
       console.log(`Updating ${group.name} with keywords:`, merged);
       
       const { error: updateError } = await supabase.from('luxe_telegram_groups')
        .update({ keywords: merged })
        .eq('id', group.id);
       
       if (updateError) {
         console.error('Update Error:', updateError);
       }
    }
  }
  console.log("Done updating!");
}

run();

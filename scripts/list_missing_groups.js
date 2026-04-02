require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function listMissing() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('luxe_telegram_groups').select('name, chat_id, invite_link');
  
  if (error) {
    console.error('Error fetching groups:', error);
    return;
  }

  const missing = data.filter(g => !g.chat_id || g.chat_id.trim() === '');
  console.log(`Found ${missing.length} groups with missing Chat ID:`);
  missing.forEach((g, idx) => {
    console.log(`${idx + 1}. [${g.name}] - Link: ${g.invite_link || 'N/A'}`);
  });
}

listMissing();

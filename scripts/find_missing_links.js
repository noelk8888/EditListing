require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findMissingLinks() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('luxe_telegram_groups').select('name, chat_id, invite_link');
  
  if (error) {
    console.error('Error fetching groups:', error);
    return;
  }

  const missing = data.filter(g => !g.invite_link || g.invite_link.trim() === '');
  console.log(`\nFound ${missing.length} groups with MISSING INVITE LINKS:`);
  missing.forEach((g, idx) => {
    console.log(`${idx + 1}. [${g.name}] (Chat ID: ${g.chat_id || 'Missing'})`);
  });
}

findMissingLinks();

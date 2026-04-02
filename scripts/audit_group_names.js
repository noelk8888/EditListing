require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function auditGroups() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('luxe_telegram_groups').select('name, chat_id, invite_link');
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  const nonLuxe = data.filter(g => !g.name.includes('x Luxe Realty'));
  console.log('\n--- GROUPS WITHOUT "x Luxe Realty" ---');
  nonLuxe.forEach((g, idx) => {
    console.log(`${idx + 1}. [${g.name}] (Chat ID: ${g.chat_id || 'null'})`);
  });

  const totalWithId = data.filter(g => !!g.chat_id?.trim()).length;
  console.log(`\nTotal with ID in entire DB: ${totalWithId}`);
}

auditGroups();

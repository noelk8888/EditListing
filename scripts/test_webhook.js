const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const chatTitle = 'BGC SALE x Luxe Realty';
  
  // Test 1: exact ilike match
  let { data, error } = await sb.from('luxe_telegram_groups').select('id, name').ilike('name', chatTitle).single();
  console.log('Exact match:', data);
  console.log('Error:', error?.message);
  
  // Test 2: fallback partial match
  if (error || !data) {
    const { data: allGroups } = await sb.from('luxe_telegram_groups').select('id, name').is('chat_id', null);
    console.log('Groups with null chat_id:', allGroups?.length);
    const titleLower = chatTitle.toLowerCase();
    const match = allGroups?.find(g => titleLower.includes(g.name.toLowerCase()));
    console.log('Partial match:', match);
  }
})();

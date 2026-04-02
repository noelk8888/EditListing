
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic env parser for a quick script
const env = {};
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
  });
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  try {
    const { data, error } = await supabase.from('KIU Properties').select('*').eq('GEO ID', 'G11709').maybeSingle();
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log(data ? JSON.stringify(data, null, 2) : 'NOT_FOUND');
    }
  } catch (e) {
    console.error('Catch:', e.message);
  }
}
check();

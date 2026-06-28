const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0;
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    `
  });
  console.log('Exec SQL:', data, error);
}

run();

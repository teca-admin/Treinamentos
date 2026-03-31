import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://teca-admin-supabase.ly7t0m.easypanel.host";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'nexus' }
});

async function test() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log('Data:', data);
    console.log('Error:', error);
  } catch (e) {
    console.error('Exception:', e);
  }
}

test();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkRLS() {
  // Using a test login if possible, or just checking public access
  // Let's attempt to read the planned activities directly with anon key
  const { data, error } = await supabase.from('planned_activity').select('*').limit(5);
  console.log("Anon Read:", data ? data.length + " rows" : error.message);
}

checkRLS();

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// We parse .env.local 
dotenv.config({ path: '.env.local' });

// Use exact credentials from .env.local used by EXPO
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase credentials not found in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPlanner() {
  console.log("Checking recently active babies...");
  const { data: babies, error } = await supabase.from('baby')
    .select('baby_id, name, is_premature, weeks_gestation, birth_date')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (error || !babies || babies.length === 0) {
    console.error("Error fetching babies", error || "No babies found");
    return;
  }
  
  console.log("Latest babies:", babies);
  
  const latestBaby = babies[0];
  console.log("\n==== TESTING AGE CALCULATION for", latestBaby.name, "====");
  
  // Dummy age calculation replicating babyLogic.ts
  const bDate = new Date(latestBaby.birth_date);
  const today = new Date();
  let diffMonths = (today.getFullYear() - bDate.getFullYear()) * 12 + today.getMonth() - bDate.getMonth();
  if (today.getDate() < bDate.getDate()) {
      diffMonths--; // rough estimate of date-fns differenceInMonths
  }
  
  console.log("Rough Chronological Age in Months:", diffMonths);
  
  let targetAgeInMonths = Math.max(0, diffMonths);
  console.log("Target Age Floored:", targetAgeInMonths);

  console.log("\n==== QUERING RANGES ====");
  let { data: rangeData, error: rErr } = await supabase
      .from('age_range')
      .select('range_id, min_months, max_months')
      .lte('min_months', targetAgeInMonths)
      .gte('max_months', targetAgeInMonths)
      .limit(1);
      
  console.log("Query 'lte min' & 'gte max' result:", rangeData, rErr ? rErr : "");
  
  let activeRangeId = null;
  if (!rangeData || rangeData.length === 0) {
      console.log("No exact range found! Falling back to the lowest range...");
      const { data: fallbackRange } = await supabase
          .from('age_range')
          .select('range_id, min_months, max_months')
          .order('min_months', { ascending: true })
          .limit(1);
      rangeData = fallbackRange;
  }
  
  if (rangeData && rangeData.length > 0) {
      activeRangeId = rangeData[0].range_id;
      console.log("Active Range Selected:", rangeData[0].min_months, "to", rangeData[0].max_months, "--> ID:", activeRangeId);
  } else {
      console.log("CRITICAL: No range found at all.");
      return;
  }

  console.log("\n==== QUERYING ACTIVITIES ====");
  const { data: activities, error: actError } = await supabase
        .from('activity')
        .select(`activity_id, stimulation_area!inner(name)`)
        .eq('range_id', activeRangeId);
        
  console.log("Activities matching this range:", activities ? activities.length : 0, actError ? actError : "");
  if (activities && activities.length > 0) {
      console.log("Sample activities areas: ", activities.slice(0, 3).map(a => a.stimulation_area.name));
  }
  
  // Checking history
  const { data: history } = await supabase
        .from('planned_activity')
        .select('activity_id')
        .eq('baby_id', latestBaby.baby_id);
  console.log("\n==== HISTORICAL PLANS ====");
  console.log("Count of planned activities for this baby:", history ? history.length : 0);
}

testPlanner();

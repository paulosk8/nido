import { supabase } from './supabase';

/**
 * Methodological Weekly Planner Utility
 * 
 * Prevents overstimulation by generating a weekly plan for a baby.
 * - Rest days: Tuesday and Sunday
 * - 1 to 2 activities maximal per active day.
 * - Methodological rotation to ensure Motor, Language, Cognitive and Social balance.
 * - Prioritizes novel activities to prevent repetition.
 */

const REST_DAYS = [0, 2]; // 0: Sunday, 2: Tuesday

// Define rotation patterns for active days (Day 1 to Day 5, mapped to Mon, Wed, Thu, Fri, Sat)
// This ensures we hit every area multiple times a week without clumping them together.
const DAILY_AREA_ROTATION = [
    ['Motor', 'Lenguaje'],           // Mon
    ['Cognitivo', 'Social'],         // Wed
    ['Lenguaje', 'Motor'],           // Thu
    ['Social', 'Cognitivo'],         // Fri
    ['Motor', 'Cognitivo']           // Sat
];

// Helpers for date manipulation
const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getEndOfWeek = (startOfWeek: Date) => {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
};

const formatDateToLocalSQL = (date: Date) => {
    const offset = date.getTimezoneOffset()
    const finalDate = new Date(date.getTime() - (offset * 60 * 1000))
    return finalDate.toISOString().split('T')[0];
}

const getAreaGroup = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('motor')) return 'Motor';
    if (name.includes('lenguaje') || name.includes('language') || name.includes('auditory')) return 'Lenguaje';
    if (name.includes('social') || name.includes('emocional')) return 'Social';
    return 'Cognitivo';
};

export const ensureWeeklyPlanExists = async (baby_id: string, range_id: string, isPremature: boolean) => {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    const endOfWeek = getEndOfWeek(startOfWeek);

    const startStr = formatDateToLocalSQL(startOfWeek);
    const endStr = formatDateToLocalSQL(endOfWeek);

    // 1. Check if a plan already exists for this week
    const { data: existingPlan, error: checkError } = await supabase
        .from('planned_activity')
        .select('id')
        .eq('baby_id', baby_id)
        .gte('assigned_date', startStr)
        .lte('assigned_date', endStr)
        .limit(1);
    if (checkError) {
        console.error("Error checking existing plan:", checkError);
        return false;
    }

    if (existingPlan && existingPlan.length > 0) return true; // Plan exists

    console.log(`[Weekly Planner] Generating NEW plan for baby: ${baby_id}, range: ${range_id}`);

    // Fetch the specific age range to determine safe stimulation load
    const { data: ageRangeData, error: ageError } = await supabase
        .from('age_range')
        .select('min_months')
        .eq('range_id', range_id)
        .single();

    if (ageError) {
        console.error("[Weekly Planner] Failed to fetch age range limits:", ageError);
    }

    const babyMonthsAge = ageRangeData?.min_months || 0;

    // 2. Fetch ALL available activities for the child's age
    const { data: activities, error: actError } = await supabase
        .from('activity')
        .select(`
            activity_id, 
            stimulation_area (name)
        `)
        .eq('range_id', range_id);

    if (actError) {
        console.error("[Weekly Planner] Activity catalog fetch error:", actError);
        return false;
    }

    if (!activities || activities.length === 0) {
        console.warn(`[Weekly Planner] CRITICAL: No activities found in the catalog for range_id: ${range_id} (Premature? ${isPremature})`);
        return false;
    }

    // 3. Fetch historic assignments to prioritize unseen activities
    const { data: history } = await supabase
        .from('planned_activity')
        .select('activity_id')
        .eq('baby_id', baby_id);

    // Count how many times each activity was assigned historically
    const usageCount: Record<string, number> = {};
    if (history) {
        history.forEach(h => {
            usageCount[h.activity_id] = (usageCount[h.activity_id] || 0) + 1;
        });
    }

    // 4. Group catalog by Target Area and sort by least used
    const groupedCatalog: Record<string, string[]> = { Motor: [], Lenguaje: [], Cognitivo: [], Social: [] };

    // Populate and shuffle within the same usage tier
    activities.forEach(act => {
        const area = getAreaGroup((act.stimulation_area as any)?.name || '');
        groupedCatalog[area].push(act.activity_id);
    });

    Object.keys(groupedCatalog).forEach(area => {
        groupedCatalog[area].sort((a, b) => {
            const countA = usageCount[a] || 0;
            const countB = usageCount[b] || 0;
            if (countA === countB) return Math.random() - 0.5; // Randomize tie breakers
            return countA - countB; // Ascending order (least used first)
        });
    });

    // Determine safe activities per day limit
    // 0-3 months: strictly 1 max (attention span < 5 min, easily overstimulated)
    // 4-12 months: 1 to 2 max
    // > 12 months: exactly 2
    let assignCountLimit = 1;
    if (babyMonthsAge >= 4 && babyMonthsAge < 12) {
        assignCountLimit = Math.random() > 0.5 ? 2 : 1;
    } else if (babyMonthsAge >= 12) {
        assignCountLimit = 2;
    }

    // 5. Assign activities methodologically
    const inserts = [];
    let activeDayIndex = 0; // Tracks which of the 5 active days we are on

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(currentDate.getDate() + i);
        const dayOfWeek = currentDate.getDay();

        if (REST_DAYS.includes(dayOfWeek)) continue; // Skip Tuesdays and Sundays

        // Get the required methodological areas for today (e.g ['Motor', 'Lenguaje'])
        const todaysTargetAreas = DAILY_AREA_ROTATION[activeDayIndex % DAILY_AREA_ROTATION.length];

        let assignedToday = 0;

        for (const targetArea of todaysTargetAreas) {
            if (assignedToday >= assignCountLimit) break; // Reached age limit

            const availableInArea = groupedCatalog[targetArea];

            if (availableInArea && availableInArea.length > 0) {
                // Pop the first element (which is the least used due to sorting)
                const selectedActivityId = availableInArea.shift()!;

                inserts.push({
                    baby_id: baby_id,
                    activity_id: selectedActivityId,
                    assigned_date: formatDateToLocalSQL(currentDate)
                });

                assignedToday++;

                // Push it back to the end of the array to allow infinite looping if catalog is small
                availableInArea.push(selectedActivityId);
            }
        }

        activeDayIndex++;
    }

    // 6. Batch Insert
    if (inserts.length > 0) {
        console.log(`[Weekly Planner] Attempting to insert ${inserts.length} activities for baby_id: ${baby_id}`);
        const { error: insertError } = await supabase
            .from('planned_activity')
            .insert(inserts);

        if (insertError) {
            console.error("[Weekly Planner] Failed to save weekly plan! Full Error:", JSON.stringify(insertError, null, 2));
            return false;
        }
        console.log(`[Weekly Planner] Successfully inserted new plan.`);
    }

    return true;
};

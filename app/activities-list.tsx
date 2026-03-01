import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Chip, Text } from 'react-native-paper';
import { calculateBabyAges } from '../lib/babyLogic';
import { supabase } from '../lib/supabase';

export default function ActivitiesListScreen() {
    const { baby_id } = useLocalSearchParams<{ baby_id: string }>();
    const router = useRouter();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [displayAge, setDisplayAge] = useState(0);

    useEffect(() => {
        const fetchActivities = async () => {
            if (!baby_id) return;

            // 1. Fetch baby details explicitly to calculate true age
            const { data: babyData, error: babyError } = await supabase
                .from('baby')
                .select('*')
                .eq('baby_id', baby_id)
                .single();

            if (babyError || !babyData) {
                console.error("Baby not found:", babyError);
                setLoading(false);
                return;
            }

            // 2. Use the dedicated baby logic
            // Assuming gestational weeks default to 40 if not premature
            const { cronological, corrected, isPremature } = calculateBabyAges(
                babyData.birth_date,
                babyData.weeks_gestation || 40
            );

            // Usa la edad corregida para actividades de estimulación si es prematuro, si no, cronológioca.
            const targetAgeInMonths = Math.floor(isPremature ? corrected : cronological);
            setDisplayAge(targetAgeInMonths);

            // 3. Find the correct range for the baby
            let { data: rangeData, error: rangeError } = await supabase
                .from('age_range')
                .select('range_id, name')
                .lte('min_months', targetAgeInMonths)
                .gte('max_months', targetAgeInMonths)
                .limit(1);

            if (rangeError || !rangeData || rangeData.length === 0) {
                console.warn(`No exact age range found for ${targetAgeInMonths} months. Attempting fallback...`);
                // Fallback: Fetch the lowest available range if the baby is very young, or highest if very old.
                const { data: fallbackRange } = await supabase
                    .from('age_range')
                    .select('range_id, name')
                    .order('min_months', { ascending: true })
                    .limit(1);

                if (!fallbackRange || fallbackRange.length === 0) {
                    console.error("No age ranges exist in the database at all.");
                    setLoading(false);
                    return;
                }

                // Proceed with the fallback range
                rangeData = fallbackRange;
            }

            const activeRangeId = rangeData[0].range_id;
            console.log("Using Range ID:", activeRangeId, "for calculated age:", targetAgeInMonths);

            // 4. Fetch activities for that range including stimulation area
            const { data: activityData, error: activityError } = await supabase
                .from('activity')
                .select(`
                    *,
                    stimulation_area ( name, icon_name, color_hex )
                `)
                .eq('range_id', activeRangeId)
                // Filter premature activities if applicable
                .eq('is_for_premature', isPremature);

            if (!activityError && activityData) {
                // Formatting data properly since category is now joined
                const formattedActivities = activityData.map((act: any) => ({
                    ...act,
                    category: act.stimulation_area?.name || 'General'
                }));
                setActivities(formattedActivities);
            } else {
                console.error("Error fetching activities:", activityError);
            }
            setLoading(false);
        };

        fetchActivities();
    }, [baby_id]);

    if (loading) return <ActivityIndicator style={styles.loader} />;

    return (
        <View style={styles.container}>
            <Text variant="headlineSmall" style={styles.header}>
                Actividades para {displayAge} meses
            </Text>
            <FlatList
                data={activities}
                keyExtractor={(item) => item.activity_id}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Title
                            title={item.title}
                            subtitle={item.category}
                            left={(props) => <Avatar.Icon {...props} icon="star" />}
                        />
                        <Card.Content>
                            <Text variant="bodyMedium">{item.description}</Text>
                            <View style={styles.chipRow}>
                                <Chip icon="clock" style={styles.chip}>
                                    {item.min_months}-{item.max_months} meses
                                </Chip>
                            </View>
                        </Card.Content>
                    </Card>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#f9fafb' },
    header: { marginBottom: 20, fontWeight: 'bold', color: '#111827' },
    card: { marginBottom: 15, borderRadius: 16 },
    loader: { flex: 1, justifyContent: 'center' },
    chipRow: { flexDirection: 'row', marginTop: 10 },
    chip: { backgroundColor: '#e5e7eb' }
});

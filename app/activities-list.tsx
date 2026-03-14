import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateBabyAges } from '../lib/babyLogic';
import { supabase } from '../lib/supabase';

// Helper mapping for areas
const AREA_UI = {
    Motor: { bg: '#FFDDC1', text: '#F57C00', icon: 'run' },
    Lenguaje: { bg: '#F0F9E8', text: '#558B2F', icon: 'chart-bar' },
    Cognitivo: { bg: '#E0F7FA', text: '#00838F', icon: 'head-lightbulb-outline' },
    Social: { bg: '#FFFFFF', text: '#3949AB', icon: 'heart' },
};

const getAreaUI = (name: string) => {
    if (!name) return AREA_UI.Cognitivo;
    if (name.includes('Motor')) return AREA_UI.Motor;
    if (name.includes('Lenguaje') || name.includes('Language') || name.includes('Auditory')) return AREA_UI.Lenguaje;
    if (name.includes('Cognitivo') || name.includes('Cognitive') || name.includes('Sensory')) return AREA_UI.Cognitivo;
    if (name.includes('Social') || name.includes('Emocional')) return AREA_UI.Social;
    return AREA_UI.Cognitivo; // fallback
};

export default function ActivitiesListScreen() {
    const { baby_id, area } = useLocalSearchParams<{ baby_id: string; area: string }>();
    const router = useRouter();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [displayAge, setDisplayAge] = useState(0);
    const [babyName, setBabyName] = useState('Bebé');
    const [progress, setProgress] = useState({ completed: 0, total: 0 });

    useEffect(() => {
        const fetchActivitiesAndProgress = async () => {
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

            setBabyName(babyData.name);

            // 2. Use the dedicated baby logic
            const { cronological, corrected, isPremature } = calculateBabyAges(
                babyData.birth_date,
                babyData.weeks_gestation || 40
            );

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
                rangeData = fallbackRange;
            }

            const activeRangeId = rangeData[0].range_id;

            // 4. Fetch activities for that range including stimulation area
            const { data: activityData, error: activityError } = await supabase
                .from('activity')
                .select(`
                    *,
                    stimulation_area ( name, icon_name, color_hex )
                `)
                .eq('range_id', activeRangeId)
                .eq('is_for_premature', isPremature);

            let filteredActivities = [];
            if (!activityError && activityData) {
                // Formatting data properly since category is now joined
                const formattedActivities = activityData.map((act: any) => ({
                    ...act,
                    category: act.stimulation_area?.name || 'General',
                    icon_name: act.stimulation_area?.icon_name || 'star'
                }));

                // If an Area string was passed from navigation, filter loosely by that area
                if (area) {
                    filteredActivities = formattedActivities.filter(a =>
                        a.category.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(a.category.toLowerCase())
                    );
                } else {
                    filteredActivities = formattedActivities;
                }
                setActivities(filteredActivities);
            } else {
                console.error("Error fetching activities:", activityError);
            }

            // 5. Calculate Real Progress inside this specific list of activities
            if (filteredActivities.length > 0) {
                const activityIds = filteredActivities.map(a => a.activity_id);

                const { data: logData, error: logError } = await supabase
                    .from('activity_log')
                    .select('activity_id, end_time')
                    .eq('baby_id', baby_id)
                    .in('activity_id', activityIds)
                    .not('end_time', 'is', null);

                if (!logError && logData) {
                    // Count unique completed activities from this specific branch
                    const uniqueCompletedIds = new Set(logData.map(log => log.activity_id));
                    setProgress({ completed: uniqueCompletedIds.size, total: filteredActivities.length });
                } else {
                    setProgress({ completed: 0, total: filteredActivities.length });
                }
            } else {
                setProgress({ completed: 0, total: 0 });
            }

            setLoading(false);
        };

        fetchActivitiesAndProgress();
    }, [baby_id, area]);

    const renderHeader = () => {
        const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
        const progressWidth = `${progressPercentage}%`;
        const titleAreaText = area ? `Área de ${area}` : 'Actividades';

        return (
            <View style={styles.headerContainer}>
                {/* Top Header */}
                <View style={styles.topHeader}>
                    <View>
                        <Text style={styles.mainTitle}>{titleAreaText}</Text>
                        <Text style={styles.subTitle}>Plan de hoy para {babyName}</Text>
                    </View>
                    <View style={styles.bellIconBox}>
                        <MaterialCommunityIcons name="bell" size={24} color="#3b82f6" />
                        <View style={styles.notificationDot} />
                    </View>
                </View>

                {/* Daily Goal Card */}
                <View style={styles.goalCard}>
                    <View style={styles.goalRow}>
                        <Text style={styles.goalTitle}>Meta Diaria</Text>
                        <View style={styles.goalBadge}>
                            <Text style={styles.goalBadgeText}>{progress.completed}/{progress.total} Completadas</Text>
                        </View>
                    </View>
                    <View style={styles.goalBarBg}>
                        <View style={[styles.goalBarFill, { width: progressWidth as any }]} />
                    </View>
                    <Text style={styles.goalFooterText}>¡Sigue así! A {babyName} le encanta.</Text>
                </View>

                {/* Recommended text */}
                <View style={styles.recommendedRow}>
                    <Text style={styles.recommendedTitle}>Todas las actividades</Text>
                </View>
            </View>
        );
    };

    const renderActivity = ({ item }: { item: any }) => {
        const areaUI = getAreaUI(item.category);

        return (
            <View
                style={styles.activityCard}
                onTouchEnd={() => router.push({ pathname: '/activity-execution', params: { activity_id: item.activity_id, baby_id } })}
            >
                <View style={[styles.iconContainer, { backgroundColor: areaUI.bg }]}>
                    <MaterialCommunityIcons name={item.icon_name || 'star'} size={28} color={areaUI.text} />
                </View>
                <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activitySubtitle}>{item.category} • {item.min_months}-{item.max_months} Meses</Text>
                    <View style={styles.tagsRow}>
                        <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}>
                            <Text style={[styles.tagText, { color: '#166534' }]}>FÁCIL</Text>
                        </View>
                        <View style={[styles.tag, { backgroundColor: '#f1f5f9' }]}>
                            <Text style={[styles.tagText, { color: '#475569' }]}>SIN MATERIAL</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.timeBadge}>
                    <MaterialCommunityIcons name="clock" size={14} color="#64748b" />
                    <Text style={styles.timeText}>{item.duration_est_minutes || 5} min</Text>
                </View>
            </View>
        );
    };

    if (loading) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={activities}
                keyExtractor={(item) => item.activity_id}
                ListHeaderComponent={renderHeader}
                renderItem={renderActivity}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#64748b' }}>No hay actividades registradas en esta área para la edad actual.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FB' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },
    listContent: {
        padding: 20,
        paddingBottom: 110, // padding extra para el menú flotante
    },
    headerContainer: {
        marginBottom: 20,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 10,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    subTitle: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    bellIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 2,
    },
    notificationDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    goalCard: {
        backgroundColor: '#438FFF',
        borderRadius: 30,
        padding: 24,
        marginBottom: 30,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
    },
    goalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    goalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    goalBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    goalBadgeText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    goalBarBg: {
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 5,
        marginBottom: 12,
        overflow: 'hidden',
        width: '100%',
    },
    goalBarFill: {
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 5,
    },
    goalFooterText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
        opacity: 0.9,
    },
    recommendedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    recommendedTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    seeAllText: {
        color: '#3b82f6',
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 2,
    },
    activityCard: {
        backgroundColor: '#ffffff',
        borderRadius: 36,
        padding: 20,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 3,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activityInfo: {
        flex: 1,
        marginRight: 10,
    },
    activityTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    activitySubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 10,
        fontWeight: '500',
    },
    tagsRow: {
        flexDirection: 'row',
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    tagText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        position: 'absolute',
        top: 20,
        right: 20,
    },
    timeText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#475569',
    },
});

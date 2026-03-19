import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBaby } from '../context/BabyContext';
import { supabase } from '../lib/supabase';

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
    return AREA_UI.Cognitivo;
};

export default function DailyPlanScreen() {
    const { selectedBaby } = useBaby();
    const router = useRouter();

    const baby_id = selectedBaby?.baby_id;
    const babyName = selectedBaby?.name || 'Bebé';

    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [completedLogs, setCompletedLogs] = useState<Record<string, any>>({});
    const [isRestDay, setIsRestDay] = useState(false);

    useEffect(() => {
        const fetchDailyPlan = async () => {
            if (!baby_id) {
                setLoading(false);
                return;
            }

            // Get local date string 'YYYY-MM-DD'
            const offset = new Date().getTimezoneOffset()
            const todayStr = new Date(new Date().getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

            // Check if today is a planned rest day (no entries in planned_activity)
            const { data: planData, error: planError } = await supabase
                .from('planned_activity')
                .select('activity_id')
                .eq('baby_id', baby_id)
                .eq('assigned_date', todayStr);

            if (planError || !planData || planData.length === 0) {
                // Determine if it's truly empty by checking if we have ANY plan this week
                const startOfWeek = new Date();
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                startOfWeek.setDate(diff);
                const startStr = new Date(startOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

                const { count } = await supabase
                    .from('planned_activity')
                    .select('*', { count: 'exact', head: true })
                    .eq('baby_id', baby_id)
                    .gte('assigned_date', startStr);

                if (count && count > 0) {
                    // Plan exists for the week, but today has 0. It's an official Rest Day.
                    setIsRestDay(true);
                    setLoading(false);
                    return;
                }
            }

            // Fetch actual activities info
            if (planData && planData.length > 0) {
                const activityIds = planData.map(p => p.activity_id);

                const { data: actData } = await supabase
                    .from('activity')
                    .select(`
                        *,
                        stimulation_area ( name, icon_name, color_hex )
                    `)
                    .in('activity_id', activityIds);

                if (actData) {
                    const formatted = actData.map((act: any) => ({
                        ...act,
                        category: act.stimulation_area?.name || 'General',
                        icon_name: act.stimulation_area?.icon_name || 'star'
                    }));
                    setActivities(formatted);

                    // Fetch logs to see if they're completed
                    const { data: logData } = await supabase
                        .from('activity_log')
                        .select('activity_id, duration_real_minutes, performance_rating')
                        .eq('baby_id', baby_id)
                        .in('activity_id', activityIds)
                        .not('end_time', 'is', null);

                    if (logData) {
                        const logsMap: Record<string, any> = {};
                        logData.forEach(l => {
                            logsMap[l.activity_id] = l;
                        });
                        setCompletedLogs(logsMap);
                    }
                }
            }

            setLoading(false);
        };

        fetchDailyPlan();
    }, [baby_id]);

    const renderHeader = () => {
        return (
            <View style={styles.headerContainer}>
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <View style={{ width: 48 }} />
                </View>

                <Text style={styles.mainTitle}>Plan de Hoy</Text>
                <Text style={styles.subTitle}>Seleccionado especialmente para {babyName}</Text>

                {Object.keys(completedLogs).length === activities.length && activities.length > 0 && (
                    <View style={styles.successCard}>
                        <MaterialCommunityIcons name="check-decagram" size={30} color="#16a34a" />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.successTitle}>¡Día Completado!</Text>
                            <Text style={styles.successText}>{babyName} ha tenido la estimulación perfecta por hoy. Déjalo descansar para que asimile su aprendizaje.</Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderActivity = ({ item }: { item: any }) => {
        const log = completedLogs[item.activity_id];
        const isCompleted = !!log;
        const areaUI = getAreaUI(item.category);

        return (
            <TouchableOpacity
                style={[styles.activityCard, isCompleted && styles.completedCard]}
                onPress={() => router.push({
                    pathname: '/activity-execution',
                    params: isCompleted
                        ? {
                            activity_id: item.activity_id,
                            baby_id,
                            readOnly: 'true',
                            rating: log.performance_rating,
                            duration: log.duration_real_minutes
                        }
                        : { activity_id: item.activity_id, baby_id }
                })}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: isCompleted ? '#e2e8f0' : areaUI.bg }]}>
                    <MaterialCommunityIcons name={item.icon_name || 'star'} size={28} color={isCompleted ? '#94a3b8' : areaUI.text} />
                </View>

                <View style={styles.activityInfo}>
                    <Text style={[styles.activityTitle, isCompleted && { color: '#94a3b8', textDecorationLine: 'line-through' }]}>{item.title}</Text>
                    <Text style={[styles.activitySubtitle, isCompleted && { color: '#cbd5e1' }]}>{item.category}</Text>
                    {!isCompleted && (
                        <View style={styles.tagsRow}>
                            <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}>
                                <Text style={[styles.tagText, { color: '#166534' }]}>FÁCIL</Text>
                            </View>
                        </View>
                    )}
                </View>

                {isCompleted ? (
                    <MaterialCommunityIcons name="check-circle" size={28} color="#22c55e" style={{ marginRight: 10 }} />
                ) : (
                    <View style={styles.timeBadge}>
                        <MaterialCommunityIcons name="clock" size={14} color="#64748b" />
                        <Text style={styles.timeText}>{item.duration_est_minutes || 5} min</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );

    if (isRestDay) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <View style={styles.topHeader}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.restDayContainer}>
                    <Image
                        source={require('../assets/images/baby_activity.png')}
                        style={styles.restImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.restTitle}>Día de Descanso</Text>
                    <Text style={styles.restSubtitle}>
                        El cerebro de {babyName} crea la mayoría de sus conexiones sinápticas mientras descansa. ¡Brindarle días de juego libre sin rutinas es vital para evitar la sobreestimulación!
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={activities}
                keyExtractor={(item) => item.activity_id}
                ListHeaderComponent={renderHeader}
                renderItem={renderActivity}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>No tienes plan para hoy. Intenta refrescar el inicio.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FB' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    headerContainer: {
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 10,
    },
    backBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 2,
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
        marginBottom: 20
    },
    successCard: {
        backgroundColor: '#dcfce7',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    successTitle: {
        color: '#166534',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4
    },
    successText: {
        color: '#15803d',
        lineHeight: 20,
        fontSize: 14
    },
    activityCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
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
    completedCard: {
        backgroundColor: '#f8fafc',
        shadowOpacity: 0.1,
        elevation: 1,
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
        marginRight: 75,
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
        marginBottom: 8,
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
    restDayContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: -60
    },
    restImage: {
        width: 200,
        height: 200,
        marginBottom: 30,
        opacity: 0.9
    },
    restTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#3b82f6',
        marginBottom: 16,
        textAlign: 'center'
    },
    restSubtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500'
    }
});

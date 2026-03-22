import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useBaby } from '../context/BabyContext';
import { supabase } from '../lib/supabase';

const AREA_UI = {
    Motor: { bg: '#FFE4cc', text: '#5D4037', icon: 'run', secondaryBg: '#fff3e6' },
    Lenguaje: { bg: '#E4F4D0', text: '#33691E', icon: 'chart-bar', secondaryBg: '#f6fbed' },
    Cognitivo: { bg: '#E0F7FA', text: '#006064', icon: 'head-lightbulb-outline', secondaryBg: '#f2fbfc' },
    Social: { bg: '#E8EAF6', text: '#283593', icon: 'heart', secondaryBg: '#f6f7fb' },
};

const RATING_UI = {
    'Lo hizo solo': { bg: '#eafaf1', text: '#27ae60', icon: 'emoticon-happy' },
    'Con ayuda': { bg: '#fdf7e3', text: '#f39c12', icon: 'account-group' },
    'No lo intentó': { bg: '#f2f4f6', text: '#7f8c8d', icon: 'emoticon-neutral' },
    'Completada': { bg: '#eafaf1', text: '#27ae60', icon: 'check-circle' },
    'Sin evaluar': { bg: '#f8fafc', text: '#64748b', icon: 'clipboard-text-outline' },
    'No realizada': { bg: '#fff1f2', text: '#e11d48', icon: 'close-circle' },
};

const getAreaUI = (name: string) => {
    if (!name) return AREA_UI.Cognitivo;
    if (name.includes('Motor')) return AREA_UI.Motor;
    if (name.includes('Lenguaje') || name.includes('Language') || name.includes('Auditory')) return AREA_UI.Lenguaje;
    if (name.includes('Cognitivo') || name.includes('Cognitive') || name.includes('Sensory')) return AREA_UI.Cognitivo;
    if (name.includes('Social') || name.includes('Emocional')) return AREA_UI.Social;
    return AREA_UI.Cognitivo;
};

export default function AreaReportScreen() {
    const { area } = useLocalSearchParams<{ area: string }>();
    const { selectedBaby } = useBaby();
    const router = useRouter();

    const baby_id = selectedBaby?.baby_id;

    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [stats, setStats] = useState({ completed: 0, total: 0 });

    useEffect(() => {
        const fetchAreaReport = async () => {
            if (!baby_id || !area) {
                setLoading(false);
                return;
            }

            // Define weekly bounds
            const offset = new Date().getTimezoneOffset()
            const startOfWeek = new Date();
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);

            const startStr = new Date(startOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
            const endStr = new Date(endOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

            // Fetch planned activities for this baby for this week
            const { data: planData } = await supabase
                .from('planned_activity')
                .select('activity_id, assigned_date')
                .eq('baby_id', baby_id)
                .gte('assigned_date', startStr)
                .lte('assigned_date', endStr);

            if (planData && planData.length > 0) {
                const activityIds = planData.map(p => p.activity_id);

                // Fetch details of those activities
                const { data: actData } = await supabase
                    .from('activity')
                    .select(`
                        *,
                        stimulation_area ( name, icon_name )
                    `)
                    .in('activity_id', activityIds);

                if (actData) {
                    const formatted = actData.map((act: any) => {
                        const plan = planData.find(p => p.activity_id === act.activity_id);
                        return {
                            ...act,
                            assigned_date: plan?.assigned_date,
                            category: act.stimulation_area?.name || 'General',
                            icon_name: act.stimulation_area?.icon_name || 'star'
                        };
                    });

                    // Filter down ONLY to the exact matching category expected by the area parameter
                    // Use a more robust substring check, taking first 5 chars handles "Cognitivo" vs "Cognitiva" and "Motor" vs "Motricidad" etc
                    const searchParamTarget = area.toLowerCase().trim().substring(0, 5);
                    const filteredByArea = formatted.filter(a => a.category.toLowerCase().includes(searchParamTarget));
                    setActivities(filteredByArea);

                    const filteredIds = filteredByArea.map(a => a.activity_id);

                    // Cross reference completed
                    const { data: logData } = await supabase
                        .from('activity_log')
                        .select('activity_id')
                        .eq('baby_id', baby_id)
                        .in('activity_id', filteredIds)
                        .not('end_time', 'is', null);

                    if (logData) {
                        const uniqueLogs = new Set(logData.map(log => log.activity_id));
                        setCompletedIds(uniqueLogs);
                        setStats({ completed: uniqueLogs.size, total: filteredByArea.length });
                    } else {
                        setStats({ completed: 0, total: filteredByArea.length });
                    }
                }
            }

            setLoading(false);
        };

        fetchAreaReport();
    }, [baby_id, area]);

    const uiColors = getAreaUI(area || "");

    const renderHeader = () => {
        const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

        return (
            <View style={styles.headerContainer}>
                <View style={[styles.topGradient, { backgroundColor: uiColors.bg }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={uiColors.text} />
                    </TouchableOpacity>

                    <View style={styles.titleRow}>
                        <View style={[styles.circleIcon, { backgroundColor: uiColors.secondaryBg }]}>
                            <MaterialCommunityIcons name={uiColors.icon as any} size={32} color={uiColors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.mainTitle, { color: uiColors.text }]} numberOfLines={2}>Reporte de {area}</Text>
                        </View>
                    </View>

                    <View style={styles.reportStatsCard}>
                        <Text style={styles.reportSub}>Progreso de esta semana</Text>
                        <Text style={styles.reportPercentage}>{percentage}%</Text>

                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: uiColors.text }]} />
                        </View>

                        <Text style={styles.reportFraction}>{stats.completed} de {stats.total} actividades completadas</Text>
                    </View>
                </View>

                <Text style={styles.listTitle}>Asignaciones de la semana</Text>
            </View>
        );
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const renderActivity = ({ item }: { item: any }) => {
        const isCompleted = completedIds.has(item.activity_id);

        return (
            <View style={[styles.activityCard, isCompleted && styles.completedCard]}>
                <View style={styles.activityInfo}>
                    <Text style={[styles.activityTitle, isCompleted && { color: '#94a3b8', textDecorationLine: 'line-through' }]}>
                        {item.title}
                    </Text>
                    <Text style={[styles.activitySubtitle, isCompleted && { color: '#cbd5e1' }]}>
                        {item.category} {item.assigned_date ? ` • ${formatDate(item.assigned_date)}` : ''}
                    </Text>
                </View>

                {isCompleted ? (
                    <View style={styles.statusBadge}>
                        <MaterialCommunityIcons name="check-circle" size={16} color="#22c55e" />
                        <Text style={[styles.statusText, { color: '#15803d' }]}>Hecho</Text>
                    </View>
                ) : (
                    (() => {
                        const activityDate = item.assigned_date ? new Date(item.assigned_date + 'T23:59:59') : new Date();
                        const isPast = activityDate < new Date();
                        
                        return isPast ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#fff1f2' }]}>
                                <MaterialCommunityIcons name="close-circle-outline" size={16} color="#e11d48" />
                                <Text style={[styles.statusText, { color: '#be123c' }]}>No realizada</Text>
                            </View>
                        ) : (
                            <View style={[styles.statusBadge, { backgroundColor: '#f1f5f9' }]}>
                                <MaterialCommunityIcons name="clock-outline" size={16} color="#64748b" />
                                <Text style={[styles.statusText, { color: '#475569' }]}>Pendiente</Text>
                            </View>
                        );
                    })()
                )}
            </View>
        );
    };

    if (loading) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={uiColors.text} />
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={activities}
                keyExtractor={(item) => item.activity_id}
                ListHeaderComponent={renderHeader}
                renderItem={renderActivity}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>No hay actividades planificadas para esta área esta semana. Revisa el plan diario.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FB' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },
    listContent: {
        paddingBottom: 40,
    },
    headerContainer: {
        marginBottom: 20,
    },
    topGradient: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 30,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        marginBottom: 20,
    },
    backBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30
    },
    circleIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    reportStatsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 2,
    },
    reportSub: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4
    },
    reportPercentage: {
        fontSize: 42,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 12
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden',
        width: '100%',
        marginBottom: 10
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4
    },
    reportFraction: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500'
    },
    listTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginHorizontal: 20,
        marginBottom: 10
    },
    activityCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 1,
    },
    completedCard: {
        backgroundColor: '#f8fafc',
    },
    activityInfo: {
        flex: 1,
        marginRight: 10,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    activitySubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        marginLeft: 4,
        fontSize: 13,
        fontWeight: 'bold',
    },
});

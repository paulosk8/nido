import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function ProgressDashboardScreen() {
    const { baby_id } = useLocalSearchParams<{ baby_id: string }>();
    const [progressData, setProgressData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFrame, setTimeFrame] = useState<'week' | 'month'>('week');

    useEffect(() => {
        const fetchProgress = async () => {
            if (!baby_id) return;
            setLoading(true);

            const offset = new Date().getTimezoneOffset();
            const now = new Date();
            let startStr = '';
            let endStr = '';

            if (timeFrame === 'week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                const startOfWeek = new Date(now);
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);

                startStr = new Date(startOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
                endStr = new Date(endOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
            } else {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

                startStr = new Date(startOfMonth.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
                endStr = new Date(endOfMonth.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
            }

            const { data: planData } = await supabase
                .from('planned_activity')
                .select('activity_id')
                .eq('baby_id', baby_id)
                .gte('assigned_date', startStr)
                .lte('assigned_date', endStr);

            const { data: areasData } = await supabase.from('stimulation_area').select('area_id, name');

            if (planData && areasData) {
                const activityIds = planData.map(p => p.activity_id);
                let activities: any[] = [];
                if (activityIds.length > 0) {
                    const { data: actData } = await supabase
                        .from('activity')
                        .select('activity_id, area_id')
                        .in('activity_id', activityIds);
                    activities = actData || [];
                }

                let completedLogs: Set<string> = new Set();
                if (activityIds.length > 0) {
                    const { data: logData } = await supabase
                        .from('activity_log')
                        .select('activity_id')
                        .eq('baby_id', baby_id)
                        .in('activity_id', activityIds)
                        .not('end_time', 'is', null);
                    if (logData) {
                        completedLogs = new Set(logData.map(l => l.activity_id));
                    }
                }

                const statsByArea = areasData.map(area => {
                    const areaActs = activities.filter(a => a.area_id === area.area_id);
                    const total = areaActs.length;
                    const completed = areaActs.filter(a => completedLogs.has(a.activity_id)).length;
                    const pending = total - completed;
                    return {
                        area_name: area.name,
                        total,
                        completed,
                        pending,
                        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
                    };
                });
                setProgressData(statsByArea);
            }
            setLoading(false);
        };
        fetchProgress();
    }, [baby_id, timeFrame]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#a78bfa" />
            </View>
        );
    }

    // Helper to map areas to prototype styles
    const getAreaStyle = (areaName: string) => {
        const lowerName = String(areaName).toLowerCase();
        if (lowerName.includes('moto')) return { bg: '#ffece0', iconBg: '#ffffff', color: '#8c593b', icon: 'run' }; // Peach
        if (lowerName.includes('lengu')) return { bg: '#e8f4d9', iconBg: '#ffffff', color: '#4d7a22', icon: 'volume-high' }; // Green
        if (lowerName.includes('cogni')) return { bg: '#e2fbfa', iconBg: '#ffffff', color: '#0f766e', icon: 'brain' }; // Cyan
        if (lowerName.includes('socio') || lowerName.includes('socia')) return { bg: '#eceeff', iconBg: '#ffffff', color: '#4338ca', icon: 'heart' }; // Purple
        return { bg: '#f1f5f9', iconBg: '#ffffff', color: '#475569', icon: 'star' }; // Default
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.headerRow}>
                    <Text variant="titleMedium" style={styles.headerTitle}>Áreas de Desarrollo</Text>
                    <Text style={styles.viewReportText}>Reporte Completo</Text>
                </View>

                {/* Toggles */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                        style={[styles.toggleBtn, timeFrame === 'week' && styles.toggleBtnActive]} 
                        onPress={() => setTimeFrame('week')}
                    >
                        <MaterialCommunityIcons name="calendar-week" size={18} color={timeFrame === 'week' ? '#fff' : '#64748b'} />
                        <Text style={[styles.toggleText, timeFrame === 'week' && styles.toggleTextActive]}>Esta Semana</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.toggleBtn, timeFrame === 'month' && styles.toggleBtnActive]} 
                        onPress={() => setTimeFrame('month')}
                    >
                        <MaterialCommunityIcons name="calendar-month" size={18} color={timeFrame === 'month' ? '#fff' : '#64748b'} />
                        <Text style={[styles.toggleText, timeFrame === 'month' && styles.toggleTextActive]}>Este Mes</Text>
                    </TouchableOpacity>
                </View>

                {progressData.length === 0 ? (
                    <Text style={styles.emptyText}>Aún no hay suficientes datos para mostrar métricas. ¡Realiza más actividades!</Text>
                ) : (
                    <View style={styles.gridContainer}>
                        {progressData.map((prog, index) => {
                            const areaName = prog.area_name || 'General';
                            const styleData = getAreaStyle(areaName);
                            const percentage = prog.percentage || 0;

                            return (
                                <View key={index} style={[styles.gridCard, { backgroundColor: styleData.bg }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.iconCircle, { backgroundColor: styleData.iconBg }]}>
                                            <MaterialCommunityIcons name={styleData.icon as any} size={20} color={styleData.color} />
                                        </View>
                                        <Text style={[styles.percentText, { color: '#1e293b' }]}>{percentage}%</Text>
                                    </View>

                                    <View style={styles.cardBody}>
                                        <Text style={[styles.areaTitle, { color: styleData.color }]}>{areaName}</Text>
                                        <View style={styles.statsRow}>
                                            <Text style={[styles.statText, { color: styleData.color }]}>Total: {prog.total}</Text>
                                            <Text style={[styles.statText, { color: styleData.color }]}>Hechas: {prog.completed}</Text>
                                            <Text style={[styles.statText, { color: styleData.color }]}>Pend.: {prog.pending}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, paddingBottom: 100, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    headerTitle: { fontWeight: 'bold', color: '#1e293b' },
    viewReportText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
    emptyText: { textAlign: 'center', marginVertical: 30, color: '#94a3b8' },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    gridCard: {
        width: '48%', // 2 columns
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        minHeight: 140,
        justifyContent: 'space-between',
        // Optional subtle shadow
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    percentText: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    cardBody: {
        marginTop: 20
    },
    areaTitle: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 8
    },
    statsRow: {
        flexDirection: 'column',
        gap: 2
    },
    statText: {
        fontSize: 12,
        opacity: 0.9,
        fontWeight: '500'
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 20,
        padding: 4,
        marginBottom: 20
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16
    },
    toggleBtnActive: {
        backgroundColor: '#3b82f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    toggleText: {
        marginLeft: 6,
        fontWeight: 'bold',
        color: '#64748b',
        fontSize: 13
    },
    toggleTextActive: {
        color: '#ffffff'
    }
});

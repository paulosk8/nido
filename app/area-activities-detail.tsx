import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBaby } from '../context/BabyContext';
import { supabase } from '../lib/supabase';

// Mapas de interfaz de usuario para reutilizar los colores de la aplicación
const AREA_UI = {
    Motor: { bg: '#EFF6FF', barColor: '#3b82f6', icon: 'run', title: 'Motor' },
    Lenguaje: { bg: '#F5F3FF', barColor: '#a855f7', icon: 'account-voice', title: 'Lenguaje' },
    Cognitivo: { bg: '#ECFDF5', barColor: '#10b981', icon: 'head-lightbulb-outline', title: 'Cognitivo' },
    Social: { bg: '#FEF2F2', barColor: '#f43f5e', icon: 'emoticon-happy-outline', title: 'Socio-afectivo' },
};

// Mapa de colores para las calificaciones dadas en el Modal
const RATING_UI = {
    'Lo hizo solo': { bg: '#eafaf1', text: '#27ae60', icon: 'emoticon-happy' },
    'Con ayuda': { bg: '#fdf7e3', text: '#f39c12', icon: 'account-group' },
    'No lo intentó': { bg: '#f2f4f6', text: '#7f8c8d', icon: 'emoticon-neutral' },
    'Completada': { bg: '#eafaf1', text: '#27ae60', icon: 'check-circle' },
    'Sin evaluar': { bg: '#f1f5f9', text: '#64748b', icon: 'help-circle-outline' },
    'No realizada': { bg: '#fff1f2', text: '#e11d48', icon: 'close-circle' },
    'Pendiente': { bg: '#f8fafc', text: '#475569', icon: 'clock-outline' },
};

export default function AreaActivitiesDetailScreen() {
    const { areaKey, timeFrame } = useLocalSearchParams<{ areaKey: string; timeFrame: string }>();
    const { selectedBaby } = useBaby();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activitiesLog, setActivitiesLog] = useState<any[]>([]);

    useEffect(() => {
        const fetchAreaDetails = async () => {
            if (!selectedBaby || !areaKey) return;
            setLoading(true);

            // Calcular el rango de fechas igual que en el dashboard de progreso
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

            try {
                // Buscamos las actividades asignadas en ese rango de tiempo
                const { data: planData } = await supabase
                    .from('planned_activity')
                    .select('activity_id, assigned_date')
                    .eq('baby_id', selectedBaby.baby_id)
                    .gte('assigned_date', startStr)
                    .lte('assigned_date', endStr);

                if (planData && planData.length > 0) {
                    const plannedIds = planData.map(p => p.activity_id);

                    // Consultamos los LOGS
                    const { data: logsData, error: logError } = await supabase
                        .from('activity_log')
                        .select(`
                            log_id,
                            start_time,
                            end_time,
                            duration_real_minutes,
                            performance_rating,
                            performance_score,
                            activity_id
                        `)
                        .eq('baby_id', selectedBaby.baby_id)
                        .in('activity_id', plannedIds);

                    // Consultamos detalles de actividades
                    const { data: actData } = await supabase
                        .from('activity')
                        .select(`
                            activity_id,
                            title,
                            duration_est_minutes,
                            stimulation_area ( name )
                        `)
                        .in('activity_id', plannedIds);

                    if (!logError && actData) {
                        const logsMap = new Map();
                        if (logsData) {
                            logsData.forEach(l => logsMap.set(l.activity_id, l));
                        }

                        const combined = actData.map(act => {
                            const plan = planData.find(p => p.activity_id === act.activity_id);
                            const log = logsMap.get(act.activity_id) || {};
                            return {
                                ...log,
                                activity: act,
                                assigned_date: plan?.assigned_date
                            };
                        });

                        // Filtramos en JavaScript por el área seleccionada
                        const filteredLogs = combined.filter((log: any) => {
                            const areaName = (log.activity?.stimulation_area as any)?.name?.toLowerCase() || '';
                            let targetArea = 'Cognitivo';
                            if (areaName.includes('motor')) targetArea = 'Motor';
                            if (areaName.includes('lenguaje') || areaName.includes('language') || areaName.includes('auditory')) targetArea = 'Lenguaje';
                            if (areaName.includes('social') || areaName.includes('emocional')) targetArea = 'Social';
                            if (areaName.includes('cognitiv') || areaName.includes('sensory')) targetArea = 'Cognitivo';

                            return targetArea === areaKey;
                        });

                        // Ordenar por assigned_date
                        filteredLogs.sort((a, b) => {
                            if (!a.assigned_date) return 1;
                            if (!b.assigned_date) return -1;
                            return new Date(a.assigned_date).getTime() - new Date(b.assigned_date).getTime();
                        });

                        setActivitiesLog(filteredLogs);
                    }
                }
            } catch (err) {
                console.error("Error fetching logs for area:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAreaDetails();
    }, [selectedBaby, areaKey, timeFrame]);

    // Format UI data
    const safeAreaKey = (areaKey as 'Motor' | 'Lenguaje' | 'Cognitivo' | 'Social') || 'Cognitivo';
    const uiInfo = AREA_UI[safeAreaKey] || AREA_UI['Cognitivo'];
    const titleTimeFrame = timeFrame === 'week' ? 'Esta Semana' : 'Este Mes';

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // Calculate Stats
    const totalMinutes = activitiesLog.reduce((acc, log) => log.end_time ? acc + (log.duration_real_minutes || log.activity?.duration_est_minutes || 0) : acc, 0);
    const totalCount = activitiesLog.filter(l => l.end_time).length;
    const scoresCount = {
        solo: activitiesLog.filter(log => log.end_time && log.performance_rating === 'Lo hizo solo').length,
        help: activitiesLog.filter(log => log.end_time && log.performance_rating === 'Con ayuda').length,
        none: activitiesLog.filter(log => log.end_time && log.performance_rating === 'No lo intentó').length,
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Mismo Estilo de App */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>{uiInfo.title}</Text>
                    <Text style={styles.headerSubtitle}>{titleTimeFrame}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={uiInfo.barColor} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* STATS HEADER */}
                    {totalCount > 0 && (
                        <View style={styles.statsContainer}>
                            <View style={styles.statsRow}>
                                <View style={styles.statBox}>
                                    <MaterialCommunityIcons name="clock-check-outline" size={24} color="#3b82f6" />
                                    <Text style={styles.statValue}>{totalMinutes}</Text>
                                    <Text style={styles.statLabel}>Minutos</Text>
                                </View>
                                <View style={styles.statsDivider} />
                                <View style={styles.statBox}>
                                    <MaterialCommunityIcons name="check-decagram-outline" size={24} color="#10b981" />
                                    <Text style={styles.statValue}>{totalCount}</Text>
                                    <Text style={styles.statLabel}>Actividades</Text>
                                </View>
                            </View>

                            <View style={styles.scoresRow}>
                                <View style={[styles.scorePill, { backgroundColor: '#eafaf1' }]}>
                                    <MaterialCommunityIcons name="emoticon-happy" size={14} color="#27ae60" />
                                    <Text style={[styles.scorePillText, { color: '#27ae60' }]}>{scoresCount.solo} Solo</Text>
                                </View>
                                <View style={[styles.scorePill, { backgroundColor: '#fdf7e3' }]}>
                                    <MaterialCommunityIcons name="account-group" size={14} color="#f39c12" />
                                    <Text style={[styles.scorePillText, { color: '#f39c12' }]}>{scoresCount.help} Ayuda</Text>
                                </View>
                                <View style={[styles.scorePill, { backgroundColor: '#f2f4f6' }]}>
                                    <MaterialCommunityIcons name="emoticon-neutral" size={14} color="#7f8c8d" />
                                    <Text style={[styles.scorePillText, { color: '#7f8c8d' }]}>{scoresCount.none} Nada</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {activitiesLog.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={60} color="#cbd5e1" style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>
                                Aún no has completado actividades para el área {uiInfo.title} {timeFrame === 'week' ? 'esta semana' : 'este mes'}.
                            </Text>
                        </View>
                    ) : (
                        activitiesLog.map((log, index) => {
                            const isCompleted = !!log.end_time;
                            const isPast = log.assigned_date ? new Date(log.assigned_date + 'T23:59:59') < new Date() : false;
                            
                            let ratingLabel = log.performance_rating;
                            if (!isCompleted) {
                                ratingLabel = isPast ? 'No realizada' : 'Pendiente';
                            } else if (!ratingLabel) {
                                ratingLabel = 'Completada';
                            }
                            
                            const rStyle = RATING_UI[ratingLabel as keyof typeof RATING_UI] || RATING_UI['Sin evaluar'];

                            return (
                                <TouchableOpacity
                                    key={log.log_id || `pending-${index}`}
                                    style={styles.logCard}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/activity-execution',
                                        params: {
                                            activity_id: log.activity?.activity_id,
                                            baby_id: selectedBaby?.baby_id,
                                            readOnly: isCompleted ? 'true' : 'false',
                                            rating: isCompleted ? log.performance_rating : undefined,
                                            duration: isCompleted ? log.duration_real_minutes : undefined
                                        }
                                    })}
                                >
                                    <View style={[styles.logIconContainer, { backgroundColor: uiInfo.bg }]}>
                                        <MaterialCommunityIcons name={uiInfo.icon as any} size={26} color={uiInfo.barColor} />
                                    </View>

                                    <View style={styles.logInfoContainer}>
                                        <Text style={styles.logTitle} numberOfLines={2}>
                                            {log.activity?.title || 'Actividad Desconocida'}
                                        </Text>
                                        <View style={styles.logMetaRow}>
                                            <MaterialCommunityIcons name="calendar-blank" size={14} color="#94a3b8" />
                                            <Text style={styles.logMetaText}>{log.assigned_date ? formatDate(log.assigned_date) : 'Sin fecha'}</Text>

                                            {(log.duration_real_minutes || log.activity?.duration_est_minutes) ? (
                                                <>
                                                    <View style={styles.dotSeparator} />
                                                    <MaterialCommunityIcons name="clock-outline" size={14} color="#94a3b8" />
                                                    <Text style={styles.logMetaText}>{log.duration_real_minutes || log.activity?.duration_est_minutes} min</Text>
                                                </>
                                            ) : null}
                                        </View>
                                    </View>

                                    {/* Evaluation Badge al lado derecho */}
                                    <View style={[styles.ratingBadge, { backgroundColor: rStyle.bg }]}>
                                        <MaterialCommunityIcons name={rStyle.icon as any} size={16} color={rStyle.text} />
                                        <Text style={[styles.ratingBadgeText, { color: rStyle.text }]}>
                                            {ratingLabel === 'Lo hizo solo' ? 'Solo' : ratingLabel === 'Con ayuda' ? 'Ayuda' : ratingLabel === 'No lo intentó' ? 'Nada' : ratingLabel}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#F8F9FB',
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 30
    },
    emptyText: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22
    },
    logCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 2,
    },
    logIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    logInfoContainer: {
        flex: 1,
        marginRight: 8
    },
    logTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 6
    },
    logMetaRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    logMetaText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4
    },
    dotSeparator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 8
    },
    ratingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 55
    },
    ratingBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 2
    },
    // Nuevos estilos para Stats
    statsContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 3,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 16
    },
    statBox: {
        alignItems: 'center',
        flex: 1
    },
    statsDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#e2e8f0'
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 6
    },
    statLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2
    },
    scoresRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 16
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    scorePillText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4
    }
});
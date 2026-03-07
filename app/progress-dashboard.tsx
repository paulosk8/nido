import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function ProgressDashboardScreen() {
    const { baby_id } = useLocalSearchParams<{ baby_id: string }>();
    const [progressData, setProgressData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            if (!baby_id) return;

            const { data, error } = await supabase
                .from('baby_progress_summary')
                .select(`
                    *,
                    stimulation_area ( name, color_hex ),
                    age_range ( name )
                `)
                .eq('baby_id', baby_id);

            if (!error && data) {
                setProgressData(data);
            }
            setLoading(false);
        };
        fetchProgress();
    }, [baby_id]);

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

                {progressData.length === 0 ? (
                    <Text style={styles.emptyText}>Aún no hay suficientes datos para mostrar métricas. ¡Realiza más actividades!</Text>
                ) : (
                    <View style={styles.gridContainer}>
                        {progressData.map((prog, index) => {
                            const areaName = prog.stimulation_area?.name || 'General';
                            const styleData = getAreaStyle(areaName);
                            // Simulating percentage based on score_average (0-10 mapped to 0-100)
                            const percentage = Math.round((prog.score_average || 0) * 10);

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
                                        <Text style={[styles.areaSubtitle, { color: styleData.color, opacity: 0.8 }]}>
                                            {prog.activities_completed} acts.
                                        </Text>
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
        marginBottom: 4
    },
    areaSubtitle: {
        fontSize: 13,
    }
});

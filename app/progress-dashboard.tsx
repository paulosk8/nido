import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, ProgressBar, Text } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export default function ProgressDashboardScreen() {
    const { baby_id } = useLocalSearchParams<{ baby_id: string }>();
    const [progressData, setProgressData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            if (!baby_id) return;

            // Fetch progress summaries from `baby_progress_summary`
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

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>Progreso del Bebé</Text>

            {progressData.length === 0 ? (
                <Text style={styles.emptyText}>Aún no hay suficientes datos para mostrar métricas. ¡Realiza más actividades!</Text>
            ) : (
                progressData.map((prog, index) => {
                    // Mapeo simple de 0-10 a 0-1 para la barra de progreso
                    const scoreScale = Math.min(Math.max((prog.score_average || 0) / 10, 0), 1);
                    const color = prog.stimulation_area?.color_hex || '#6200ee';

                    return (
                        <Card key={index} style={styles.card}>
                            <Card.Title
                                title={prog.stimulation_area?.name || 'Área'}
                                subtitle={`Etapa: ${prog.age_range?.name || 'N/A'}`}
                            />
                            <Card.Content>
                                <View style={styles.statRow}>
                                    <Text>Actividades Completadas: {prog.activities_completed}</Text>
                                    <Text style={{ color: prog.is_area_mastered ? 'green' : 'gray', fontWeight: 'bold' }}>
                                        {prog.is_area_mastered ? '¡Dominado!' : 'En Progreso'}
                                    </Text>
                                </View>

                                <Text style={styles.scoreText}>Puntuación Media: {parseFloat(prog.score_average).toFixed(1)} / 10</Text>
                                <ProgressBar progress={scoreScale} color={color} style={styles.progressBar} />
                            </Card.Content>
                        </Card>
                    );
                })
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#334155' },
    card: { marginBottom: 15, borderRadius: 24, backgroundColor: '#ffffff', elevation: 2 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    scoreText: { marginTop: 10, marginBottom: 5, fontWeight: '600', color: '#475569' },
    progressBar: { height: 10, borderRadius: 8 },
    emptyText: { textAlign: 'center', marginVertical: 30, color: '#94a3b8' }
});

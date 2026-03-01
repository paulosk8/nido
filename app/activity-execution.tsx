import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export default function ActivityExecutionScreen() {
    const { activity_id, baby_id } = useLocalSearchParams<{ activity_id: string; baby_id: string }>();
    const router = useRouter();

    const [activity, setActivity] = useState<any>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [logId, setLogId] = useState<string | null>(null);

    useEffect(() => {
        const fetchActivity = async () => {
            const { data } = await supabase
                .from('activity')
                .select('*')
                .eq('activity_id', activity_id)
                .single();
            setActivity(data);
        };
        if (activity_id) fetchActivity();
    }, [activity_id]);

    const handleStartActivity = async () => {
        setIsStarted(true);
        setStartTime(new Date());

        // Insert new activity_log
        const { data, error } = await supabase
            .from('activity_log')
            .insert([{
                baby_id,
                activity_id,
                start_time: new Date()
            }])
            .select('log_id')
            .single();

        if (!error && data) {
            setLogId(data.log_id);
        }
    };

    const handleFinishActivity = async () => {
        if (!logId || !startTime) return;
        const endTime = new Date();
        const durationRealMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        await supabase
            .from('activity_log')
            .update({
                end_time: endTime,
                duration_real_minutes: durationRealMinutes
            })
            .eq('log_id', logId);

        // Redirect to evaluation
        router.push({
            pathname: '/evaluation',
            params: { log_id: logId, activity_id }
        });
    };

    if (!activity) return <Text>Cargando...</Text>;

    return (
        <View style={styles.container}>
            <Card style={styles.card}>
                <Card.Title title={activity.title} />
                <Card.Content>
                    <Text variant="bodyLarge">{activity.instructions || activity.description}</Text>
                    {activity.duration_est_minutes && (
                        <Text style={styles.metaText}>Duración estimada: {activity.duration_est_minutes} min</Text>
                    )}
                </Card.Content>
            </Card>

            <View style={styles.actionContainer}>
                {!isStarted ? (
                    <Button mode="contained" onPress={handleStartActivity} style={styles.btn}>
                        Iniciar Actividad
                    </Button>
                ) : (
                    <Button mode="contained" buttonColor="#d97706" onPress={handleFinishActivity} style={styles.btn}>
                        Finalizar Actividad
                    </Button>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f8fafc', justifyContent: 'center' },
    card: { marginBottom: 30, borderRadius: 24, backgroundColor: '#ffffff', elevation: 2 },
    actionContainer: { alignItems: 'center' },
    btn: { width: '80%', paddingVertical: 10, borderRadius: 24 },
    metaText: { marginTop: 15, fontWeight: 'bold', color: '#94a3b8' }
});

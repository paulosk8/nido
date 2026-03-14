import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function ActivityExecutionScreen() {
    const { activity_id, baby_id } = useLocalSearchParams<{ activity_id: string; baby_id: string }>();
    const router = useRouter();

    const [activity, setActivity] = useState<any>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [logId, setLogId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!activity_id) return;
            const { data } = await supabase
                .from('activity')
                .select(`
                    *,
                    age_range ( name )
                `)
                .eq('activity_id', activity_id)
                .single();
            setActivity(data);
            setLoading(false);
        };
        fetchActivity();
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

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    if (!activity) return null;

    const ageRangeName = activity.age_range?.name || '0-3 Meses';

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detalles de Actividad</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Hero Image Section */}
                <View style={styles.heroContainer}>
                    <Image
                        source={require('../assets/images/baby_activity.png')}
                        style={styles.heroImage}
                        resizeMode="cover"
                        defaultSource={require('../assets/images/baby_activity.png')}
                    />
                    <View style={styles.heroOverlay}>
                        <View style={styles.durationBadge}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#3b82f6" style={{ marginRight: 4 }} />
                            <Text style={styles.durationText}>{activity.duration_est_minutes || 5} Minutos</Text>
                        </View>
                    </View>
                </View>

                {/* Title and Meta Info */}
                <Text style={styles.title}>{activity.title}</Text>

                {/* Description Card */}
                <View style={styles.descCard}>
                    <Text style={styles.descText}>
                        {activity.instructions || activity.description || 'Sigue las instrucciones cuidadosamente para asegurar una estimulación adecuada del neurodesarrollo.'}
                    </Text>
                </View>

                {/* Simulated "How to Play" / Safety Warning */}
                <Text style={styles.sectionTitle}>Cómo jugar</Text>

                <View style={styles.safetyCard}>
                    <MaterialCommunityIcons name="shield-check" size={24} color="#ea580c" style={{ marginRight: 12, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.safetyTitle}>La Seguridad es Primero</Text>
                        <Text style={styles.safetyDesc}>
                            Asegúrate de que el área esté libre de objetos peligrosos y mantén siempre la supervisión constante durante la actividad.
                        </Text>
                    </View>
                </View>

                {/* Dynamic Steps from Description (Simple string split by points or newlines could work, or just display as one step) */}
                <View style={styles.stepContainer}>
                    <View style={styles.stepIndicator}>
                        <View style={styles.stepCircle}>
                            <Text style={styles.stepNumber}>1</Text>
                        </View>
                        <View style={styles.stepLine} />
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Ejecución</Text>
                        <Text style={styles.stepDesc}>{activity.description}</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Bottom Action Button */}
            <View style={styles.footer}>
                {!isStarted ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleStartActivity} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="play" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryBtnText}>Iniciar Actividad</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#ea580c' }]} onPress={handleFinishActivity} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="check-all" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryBtnText}>Finalizar Actividad</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FB'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
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
    scrollContent: {
        padding: 20,
        paddingBottom: 100
    },
    heroContainer: {
        width: '100%',
        height: 250,
        borderRadius: 30,
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
        marginBottom: 24,
        position: 'relative'
    },
    heroImage: {
        width: '100%',
        height: '100%'
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    durationText: {
        color: '#3b82f6',
        fontWeight: 'bold',
        fontSize: 14
    },
    shareBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 16,
        letterSpacing: -0.5
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24
    },
    ageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 12
    },
    ageText: {
        color: '#3b82f6',
        fontWeight: '600',
        fontSize: 13
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        color: '#64748b',
        fontWeight: '500',
        fontSize: 13
    },
    descCard: {
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 24,
        marginBottom: 30,
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 2
    },
    descText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 24
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16
    },
    safetyCard: {
        flexDirection: 'row',
        backgroundColor: '#fff7ed',
        padding: 16,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#ffedd5'
    },
    safetyTitle: {
        color: '#c2410c',
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 4
    },
    safetyDesc: {
        color: '#ea580c',
        fontSize: 13,
        lineHeight: 20
    },
    stepContainer: {
        flexDirection: 'row',
        marginBottom: 20
    },
    stepIndicator: {
        alignItems: 'center',
        marginRight: 16
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    stepNumber: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14
    },
    stepLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#e2e8f0',
        marginTop: 8
    },
    stepContent: {
        flex: 1,
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 24,
        shadowColor: '#e2e8f0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 1
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 6
    },
    stepDesc: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 22
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 30,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9'
    },
    primaryBtn: {
        backgroundColor: '#3b82f6',
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold'
    }
});

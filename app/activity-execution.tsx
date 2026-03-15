import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, ActivityIndicator as RNActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Mapa de colores para las calificaciones (reused from area details)
const RATING_UI = {
    'Lo hizo solo': { bg: '#eafaf1', text: '#27ae60', icon: 'emoticon-happy' },
    'Con ayuda': { bg: '#fdf7e3', text: '#f39c12', icon: 'account-group' },
    'No lo intentó': { bg: '#f2f4f6', text: '#7f8c8d', icon: 'emoticon-neutral' },
};

export default function ActivityExecutionScreen() {
    const { activity_id, baby_id, readOnly, rating, duration } = useLocalSearchParams<{ activity_id: string; baby_id: string; readOnly?: string; rating?: string; duration?: string }>();
    const router = useRouter();

    const [activity, setActivity] = useState<any>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [logId, setLogId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEvalModalVisible, setIsEvalModalVisible] = useState(false);
    const [evalLoading, setEvalLoading] = useState(false);

    // Timer State
    const [isTimerVisible, setIsTimerVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes default (in seconds)
    const [timerActive, setTimerActive] = useState(false);
    const [actualDurationSeconds, setActualDurationSeconds] = useState(0);

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

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerActive) {
            interval = setInterval(() => {
                setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
                setActualDurationSeconds((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive]);

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
            // Default 5 mins if not specified
            setTimeLeft((activity?.duration_est_minutes || 5) * 60);
            setActualDurationSeconds(0);
            setIsTimerVisible(true);
            setTimerActive(true);
        }
    };

    const handleFinishActivity = async () => {
        setTimerActive(false);
        setIsEvalModalVisible(true);
    };

    const handleResetTimer = () => {
        setTimerActive(false);
        setTimeLeft((activity?.duration_est_minutes || 5) * 60);
        setActualDurationSeconds(0);
    };

    const submitEvaluation = async (rating: string) => {
        if (!logId || !startTime) return;
        setEvalLoading(true);
        const endTime = new Date();
        const durationRealMinutes = Math.round(actualDurationSeconds / 60) || 1; // At least 1 min if they try

        // calculate score based on age
        const ageRangeName = activity.age_range?.name || '0-3 Meses';
        let score = 0;

        if (rating === 'No lo intentó') {
            score = 0;
        } else if (ageRangeName.includes('0-3') || ageRangeName.includes('3-6')) {
            // For young babies, trying with help is great
            if (rating === 'Con ayuda') score = 10;
            if (rating === 'Lo hizo solo') score = 10;
        } else {
            // For older babies
            if (rating === 'Con ayuda') score = 5;
            if (rating === 'Lo hizo solo') score = 10;
        }

        await supabase
            .from('activity_log')
            .update({
                end_time: endTime,
                duration_real_minutes: durationRealMinutes,
                performance_rating: rating,
                performance_score: score
            })
            .eq('log_id', logId);

        setEvalLoading(false);
        setIsEvalModalVisible(false);
        setIsTimerVisible(false);
        router.replace('/(tabs)');
    };

    const handleSkip = async () => {
        if (!logId || !startTime) return;
        setEvalLoading(true);
        const endTime = new Date();
        const durationRealMinutes = Math.round(actualDurationSeconds / 60) || 1;

        await supabase
            .from('activity_log')
            .update({
                end_time: endTime,
                duration_real_minutes: durationRealMinutes
            })
            .eq('log_id', logId);

        setEvalLoading(false);
        setIsEvalModalVisible(false);
        setIsTimerVisible(false);
        router.replace('/(tabs)');
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

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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
                            <MaterialCommunityIcons
                                name={readOnly === 'true' ? "clock-check-outline" : "clock-outline"}
                                size={16}
                                color="#3b82f6"
                                style={{ marginRight: 4 }}
                            />
                            <Text style={styles.durationText}>
                                {readOnly === 'true'
                                    ? `Realizado en ${duration !== undefined && duration !== 'undefined' && duration !== 'null' ? duration : 0} Minutos`
                                    : `${activity.duration_est_minutes || 5} Minutos`
                                }
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Title and Meta Info */}
                <Text style={styles.title}>{activity.title}</Text>

                {/* Read Only Rating Badge */}
                {readOnly === 'true' && rating && (
                    <View style={styles.readOnlyBadgeRow}>
                        <View style={[styles.readOnlyBadge, { backgroundColor: RATING_UI[rating as keyof typeof RATING_UI]?.bg || '#f1f5f9' }]}>
                            <MaterialCommunityIcons
                                name={RATING_UI[rating as keyof typeof RATING_UI]?.icon as any || 'help'}
                                size={18}
                                color={RATING_UI[rating as keyof typeof RATING_UI]?.text || '#64748b'}
                            />
                            <Text style={[styles.readOnlyBadgeText, { color: RATING_UI[rating as keyof typeof RATING_UI]?.text || '#64748b' }]}>
                                Desempeño: {rating}
                            </Text>
                        </View>
                    </View>
                )}

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

            {/* Bottom Action Button            {/* Botón inferior fijo */}
            {readOnly !== 'true' && !isStarted && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={handleStartActivity}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="play-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryBtnText}>Iniciar Actividad</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modal de Evaluación */}
            <Modal
                visible={isEvalModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEvalModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsEvalModalVisible(false)}>
                            <MaterialCommunityIcons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Evaluación</Text>
                        <Text style={styles.modalSubtitle}>¿Cómo le fue a tu bebé?</Text>

                        <View style={styles.iconCircleWrapper}>
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons name="tree" size={28} color="#45b5aa" />
                            </View>
                            <View style={styles.iconShadow} />
                        </View>

                        {/* Option 1: Lo hizo solo */}
                        <TouchableOpacity
                            style={[styles.evalOption, { backgroundColor: '#eafaf1' }]}
                            onPress={() => submitEvaluation('Lo hizo solo')}
                            disabled={evalLoading}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.evalIconRound, { backgroundColor: '#27ae60' }]}>
                                    <MaterialCommunityIcons name="emoticon-happy" size={20} color="#fff" />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.evalOptionTitle}>Lo hizo solo</Text>
                                    <Text style={styles.evalOptionDesc}>Sin ayuda externa</Text>
                                </View>
                            </View>
                            <View style={[styles.radioCircle, { borderColor: '#73c686', backgroundColor: '#eafaf1' }]} />
                        </TouchableOpacity>

                        {/* Option 2: Con ayuda */}
                        <TouchableOpacity
                            style={[styles.evalOption, { backgroundColor: '#fdf7e3' }]}
                            onPress={() => submitEvaluation('Con ayuda')}
                            disabled={evalLoading}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.evalIconRound, { backgroundColor: '#f39c12' }]}>
                                    <MaterialCommunityIcons name="account-group" size={20} color="#fff" />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.evalOptionTitle}>Con ayuda</Text>
                                    <Text style={styles.evalOptionDesc}>Necesitó un empujoncito</Text>
                                </View>
                            </View>
                            <View style={[styles.radioCircle, { borderColor: '#fcdb94', backgroundColor: '#fdf7e3' }]} />
                        </TouchableOpacity>

                        {/* Option 3: No lo intentó */}
                        <TouchableOpacity
                            style={[styles.evalOption, { backgroundColor: '#f2f4f6' }]}
                            onPress={() => submitEvaluation('No lo intentó')}
                            disabled={evalLoading}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.evalIconRound, { backgroundColor: '#7f8c8d' }]}>
                                    <MaterialCommunityIcons name="emoticon-neutral" size={20} color="#fff" />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.evalOptionTitle}>No lo intentó</Text>
                                    <Text style={styles.evalOptionDesc}>Quizás la próxima vez</Text>
                                </View>
                            </View>
                            <View style={[styles.radioCircle, { borderColor: '#bdc3c7', backgroundColor: '#f2f4f6' }]} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={evalLoading}>
                            {evalLoading ? (
                                <RNActivityIndicator size="small" color="#3b82f6" />
                            ) : (
                                <Text style={styles.skipBtnText}>Omitir por ahora</Text>
                            )}
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>

            {/* Modal del Temporizador Flotante */}
            <Modal
                visible={isTimerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsTimerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.timerModalContent}>
                        <Text style={styles.modalTitle}>En Progreso</Text>
                        <Text style={styles.modalSubtitle}>{activity?.title}</Text>

                        {/* Animated Clock Circle */}
                        <View style={styles.timerCircle}>
                            <Text style={[styles.timerText, timeLeft <= 10 && { color: '#ef4444' }]}>
                                {formatTime(timeLeft)}
                            </Text>
                        </View>

                        {/* Controls */}
                        <View style={styles.timerControlsRow}>
                            <TouchableOpacity
                                style={[styles.timerControlBtn, { backgroundColor: '#f8fafc', shadowColor: 'transparent', elevation: 0, marginRight: 16 }]}
                                onPress={handleResetTimer}
                            >
                                <MaterialCommunityIcons
                                    name="restart"
                                    size={32}
                                    color="#64748b"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.timerControlBtn}
                                onPress={() => setTimerActive(!timerActive)}
                            >
                                <MaterialCommunityIcons
                                    name={timerActive ? 'pause' : 'play'}
                                    size={40}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.timerStatusText}>
                            {timerActive ? 'La actividad está en curso' : 'Actividad pausada'}
                        </Text>

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: '#ea580c', width: '100%', marginTop: 24 }]}
                            onPress={() => {
                                setTimerActive(false);
                                setIsTimerVisible(false);
                                handleFinishActivity();
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="check-all" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryBtnText}>Finalizar Actividad</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
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
    readOnlyBadgeRow: {
        flexDirection: 'row',
        marginBottom: 20
    },
    readOnlyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    readOnlyBadgeText: {
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 6
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#ffffff',
        borderRadius: 30,
        padding: 24,
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    closeModalBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0f172a',
        alignSelf: 'flex-start',
        marginBottom: 4
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#64748b',
        alignSelf: 'flex-start',
        marginBottom: 20
    },
    iconCircleWrapper: {
        alignItems: 'center',
        marginBottom: 24
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e6f7f5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 6,
        borderColor: '#ffffff',
        shadowColor: '#cbd5e1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5
    },
    iconShadow: {
        width: 40,
        height: 4,
        backgroundColor: '#cbd5e1',
        borderRadius: 2,
        marginTop: 8,
        opacity: 0.4
    },
    evalOption: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12
    },
    evalIconRound: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    evalOptionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    evalOptionDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
    },
    skipBtn: {
        marginTop: 16,
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    skipBtnText: {
        color: '#3b82f6',
        fontWeight: '600',
        fontSize: 15
    },
    timerModalContent: {
        width: '90%',
        backgroundColor: '#ffffff',
        borderRadius: 40,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10
    },
    timerCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 8,
        borderColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 30,
        backgroundColor: '#ffffff',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5
    },
    timerText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#3b82f6',
        letterSpacing: -1
    },
    timerControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    timerControlBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8
    },
    timerStatusText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500'
    }
});

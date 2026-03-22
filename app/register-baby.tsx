import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import { calculateBabyAges } from '../lib/babyLogic';
import { supabase } from '../lib/supabase';
import { ensureWeeklyPlanExists } from '../lib/weeklyPlanner';
import * as ImagePicker from 'expo-image-picker';
const { decode } = require('base-64');
import * as FileSystem from 'expo-file-system/legacy';

const { width } = Dimensions.get('window');

export default function RegisterBabyScreen() {
    const { user } = useAuth();
    const { babies, refreshBabies } = useBaby();
    const router = useRouter();

    const [name, setName] = useState('');
    const [birthDate, setBirthDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isPremature, setIsPremature] = useState(false);
    const [weeks, setWeeks] = useState('');
    const [gender, setGender] = useState<'M' | 'F' | 'O'>('O');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos permisos para acceder a tu galería');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0].uri) {
            setProfileImage(result.assets[0].uri);
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setBirthDate(selectedDate);
        }
    };

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleRegister = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Por favor ingresa el nombre del bebé.');
            return;
        }

        if (isPremature && (!weeks || isNaN(parseInt(weeks)))) {
            return Alert.alert('Error', 'Indica las semanas de gestación válidas');
        }

        const now = new Date();
        const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + now.getMonth() - birthDate.getMonth();
        if (ageInMonths > 36) {
            return Alert.alert('Aviso', 'Nido está diseñado para la estimulación temprana de niños de 0 a 36 meses (3 años).');
        }

        if (babies.length >= 2) {
            return Alert.alert('Límite Alcanzado', 'Actualmente solo puedes registrar un máximo de 2 bebés por cuenta.');
        }

        if (!acceptedTerms) {
            Alert.alert('Atención', 'Debes aceptar los términos y condiciones de uso para continuar.');
            return;
        }

        setLoading(true);
        const parsedWeeks = isPremature ? parseInt(weeks) : 40;
        const formattedDate = formatDate(birthDate);

        // Upload Profile Image to Supabase
        let uploadedImageUrl = null;
        if (profileImage) {
            try {
                // Android compat: use ArrayBuffer instead of Blob from fetch
                const base64 = await FileSystem.readAsStringAsync(profileImage, { encoding: 'base64' });
                const arrayBuffer = new Uint8Array(decode(base64).split('').map((c: string) => c.charCodeAt(0))).buffer;
                const filePath = `babies/${user?.id}/${new Date().getTime()}.jpg`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, arrayBuffer, { contentType: 'image/jpeg' });

                if (uploadError) {
                    console.error('Error uploading image', uploadError);
                } else if (uploadData) {
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    uploadedImageUrl = urlData.publicUrl;
                }
            } catch (err) {
                console.error('Failed processing image:', err);
            }
        }

        const { data: newBaby, error } = await supabase.from('baby').insert([{
            tutor_id: user?.id,
            name,
            birth_date: formattedDate,
            weeks_gestation: parsedWeeks,
            is_premature: isPremature,
            sex: gender,
            profile_image_url: uploadedImageUrl
        }]).select('baby_id').single();

        if (error || !newBaby) {
            Alert.alert('Error', error?.message || 'No se pudo crear el perfil del bebé');
        } else {
            // Actively generate weekly plan immediately upon creation
            try {
                const { cronological, corrected } = calculateBabyAges(formattedDate, parsedWeeks);
                const targetAgeInMonths = Math.floor(isPremature ? corrected : cronological);

                // Fetch correct range
                let { data: rangeData } = await supabase
                    .from('age_range')
                    .select('range_id')
                    .lte('min_months', targetAgeInMonths)
                    .gte('max_months', targetAgeInMonths)
                    .limit(1);

                if (!rangeData || rangeData.length === 0) {
                    const { data: fallbackRange } = await supabase
                        .from('age_range')
                        .select('range_id')
                        .order('min_months', { ascending: true })
                        .limit(1);
                    rangeData = fallbackRange;
                }

                if (rangeData && rangeData.length > 0) {
                    const activeRangeId = rangeData[0].range_id;
                    const planCreated = await ensureWeeklyPlanExists(newBaby.baby_id, activeRangeId, isPremature);

                    if (!planCreated) {
                        console.warn('Weekly plan skipped or failed during registration');
                    }
                }
            } catch (err: any) {
                console.error('Error generating initial plan:', err);
                // We won't block the user, but we log the issue
            }

            await refreshBabies();
            router.replace('/(tabs)');
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>

                    {/* Header */}
                    <Text style={styles.title}>Cuéntanos sobre tu{'\n'}<Text style={styles.titleHighlight}>pequeño/a</Text></Text>
                    <Text style={styles.subtitle}>
                        Personalizaremos el plan de estimulación según la edad de tu bebé.
                    </Text>

                    {/* Image Picker */}
                    <View style={styles.imagePickerContainer}>
                        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} activeOpacity={0.8}>
                            {profileImage ? (
                                <View style={styles.uploadedImagePreview}>
                                    <MaterialCommunityIcons name="image" size={40} color={Colors.palette.primary} />
                                    <Text style={{color: Colors.palette.primary, marginTop: 8, fontWeight: 'bold'}}>Foto Añadida</Text>
                                </View>
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <MaterialCommunityIcons name="camera-plus" size={32} color="#94a3b8" />
                                    <Text style={styles.placeholderText}>Añadir Foto</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.formContainer}>
                        <Text style={styles.label}>Nombre del bebé</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            mode="outlined"
                            style={styles.input}
                            placeholder="ej. Oliver"
                            textColor={Colors.palette.textDark}
                            outlineColor="transparent"
                            activeOutlineColor={Colors.palette.primary}
                            theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                            right={<TextInput.Icon icon="face-man-profile" color={Colors.palette.primary} />}
                        />
                        
                        <Text style={styles.label}>Género</Text>
                        <View style={styles.genderRow}>
                            <TouchableOpacity 
                                style={[styles.genderBtn, gender === 'M' && styles.genderBtnActive]} 
                                onPress={() => setGender('M')}
                            >
                                <MaterialCommunityIcons name="face-man" size={24} color={gender === 'M' ? '#ffffff' : '#94a3b8'} />
                                <Text style={[styles.genderText, gender === 'M' && styles.genderTextActive]}>Niño</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.genderBtn, gender === 'F' && styles.genderBtnActive]} 
                                onPress={() => setGender('F')}
                            >
                                <MaterialCommunityIcons name="face-woman" size={24} color={gender === 'F' ? '#ffffff' : '#94a3b8'} />
                                <Text style={[styles.genderText, gender === 'F' && styles.genderTextActive]}>Niña</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Fecha de Nacimiento</Text>

                        {Platform.OS === 'ios' ? (
                            <View style={styles.iosDatePickerContainer}>
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={birthDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleDateChange}
                                    maximumDate={new Date()}
                                    textColor={Colors.palette.textDark}
                                    style={{ height: 120 }}
                                />
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                                    <View pointerEvents="none">
                                        <TextInput
                                            value={formatDate(birthDate)}
                                            mode="outlined"
                                            style={styles.input}
                                            placeholder="AAAA-MM-DD"
                                            textColor={Colors.palette.textDark}
                                            outlineColor="transparent"
                                            activeOutlineColor={Colors.palette.primary}
                                            theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                                            right={<TextInput.Icon icon="calendar-month" color={Colors.palette.primary} />}
                                            editable={false}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {showDatePicker && (
                                    <DateTimePicker
                                        testID="dateTimePicker"
                                        value={birthDate}
                                        mode="date"
                                        display="default"
                                        onChange={handleDateChange}
                                        maximumDate={new Date()}
                                    />
                                )}
                            </>
                        )}

                        <View style={styles.switchContainer}>
                            <View style={styles.switchIconContainer}>
                                <Ionicons name="medical" size={20} color={Colors.palette.primary} />
                            </View>
                            <View style={styles.switchTextContainer}>
                                <Text style={styles.switchTitle}>¿Nacimiento prematuro?</Text>
                                <Text style={styles.switchSubtitle}>Ajusta la edad de desarrollo</Text>
                            </View>
                            <Switch
                                value={isPremature}
                                onValueChange={setIsPremature}
                                trackColor={{ false: '#E5E7EB', true: Colors.palette.primary + '80' }}
                                thumbColor={isPremature ? Colors.palette.primary : '#f4f3f4'}
                            />
                        </View>

                        {isPremature && (
                            <View style={styles.weeksContainer}>
                                <Text style={styles.label}>Semanas de Gestación</Text>
                                <TextInput
                                    value={weeks}
                                    onChangeText={setWeeks}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={styles.input}
                                    placeholder="ej. 34"
                                    textColor={Colors.palette.textDark}
                                    outlineColor="transparent"
                                    activeOutlineColor={Colors.palette.primary}
                                    theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                                />
                            </View>
                        )}

                        {/* Immutable warning message */}
                        <View style={styles.warningBox}>
                            <Ionicons name="warning" size={20} color="#b45309" />
                            <Text style={styles.warningText}>
                                Nota importante: La fecha de nacimiento no podrá ser editada posteriormente ya que es clave para estructurar metodología de estimulación semanal de tu bebé.
                            </Text>
                        </View>
                        
                        {/* Terms and Conditions */}
                        <TouchableOpacity 
                            style={styles.termsRow} 
                            onPress={() => setAcceptedTerms(!acceptedTerms)}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons 
                                name={acceptedTerms ? "checkbox-marked" : "checkbox-blank-outline"} 
                                size={24} 
                                color={acceptedTerms ? Colors.palette.primary : "#94a3b8"} 
                            />
                            <Text style={styles.termsText}>
                                Entiendo que Nido es una guía de estimulación recomendada. Como tutor, asumo la responsabilidad y velaré por la seguridad del bebé al realizar las actividades. Entiendo que la app no se responsabiliza de posibles incidentes.
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }} />

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text style={styles.primaryButtonText}>
                                {loading ? 'Guardando...' : 'Finalizar e Ingresar'}
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIconRight} />
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.palette.backgroundLight,
    },
    container: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    imagePickerContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    imagePickerBtn: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden'
    },
    placeholderAvatar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 4,
        fontWeight: 'bold'
    },
    uploadedImagePreview: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.palette.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    genderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    genderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.palette.white,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    genderBtnActive: {
        backgroundColor: Colors.palette.primary,
        borderColor: Colors.palette.primary,
    },
    genderText: {
        marginLeft: 8,
        fontSize: 15,
        fontWeight: 'bold',
        color: '#64748b',
    },
    genderTextActive: {
        color: '#ffffff',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    stepCompleted: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.palette.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepActive: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.palette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    stepActiveText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    stepInactive: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepInactiveText: {
        color: Colors.palette.textMuted,
        fontWeight: 'bold',
    },
    progressLine: {
        width: 20,
        height: 2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.palette.textDark,
        textAlign: 'center',
        marginBottom: 8,
    },
    titleHighlight: {
        color: Colors.palette.primary,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.palette.textMuted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    formContainer: {
        width: '100%',
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.palette.textDark,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        marginBottom: 20,
        backgroundColor: Colors.palette.white,
        fontSize: 15,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.palette.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    switchIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.palette.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    switchTextContainer: {
        flex: 1,
    },
    switchTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.palette.textDark,
    },
    switchSubtitle: {
        fontSize: 13,
        color: Colors.palette.textMuted,
        marginTop: 2,
    },
    weeksContainer: {
        marginTop: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
    },
    backButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.palette.white,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    primaryButton: {
        flex: 1,
        marginLeft: 16,
        backgroundColor: Colors.palette.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 30,
        paddingVertical: 14,
        shadowColor: Colors.palette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonIconRight: {
        marginLeft: 8,
    },
    iosDatePickerContainer: {
        backgroundColor: Colors.palette.white,
        borderRadius: 12,
        padding: 8,
        marginBottom: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: '#fef3c7',
        padding: 16,
        borderRadius: 16,
        marginTop: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fde68a'
    },
    warningText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 13,
        color: '#b45309',
        lineHeight: 20
    },
    termsRow: {
        flexDirection: 'row',
        marginTop: 20,
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    termsText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
    }
});

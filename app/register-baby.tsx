import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function RegisterBabyScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [birthDate, setBirthDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isPremature, setIsPremature] = useState(false);
    const [weeks, setWeeks] = useState('');
    const [loading, setLoading] = useState(false);

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
        if (!name) return Alert.alert('Error', 'El nombre es obligatorio');

        if (isPremature && (!weeks || isNaN(parseInt(weeks)))) {
            return Alert.alert('Error', 'Indica las semanas de gestación válidas');
        }

        setLoading(true);
        const parsedWeeks = isPremature ? parseInt(weeks) : 40;
        const formattedDate = formatDate(birthDate);

        const { error } = await supabase.from('baby').insert([{
            tutor_id: user?.id,
            name,
            birth_date: formattedDate,
            weeks_gestation: parsedWeeks,
            is_premature: isPremature,
            sex: 'O' // Defaulting
        }]);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
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
    }
});

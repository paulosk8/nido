import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import Colors from '../constants/Colors';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithEmail() {
        if (!email || !password) return Alert.alert('Error', 'Completa los campos');
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            Alert.alert('Error', error.message);
            setLoading(false);
        } else {
            if (data?.session?.user) {
                const tutor_upsert = await supabase.from('tutor').upsert([
                    {
                        tutor_id: data.session.user.id,
                        email: data.session.user.email
                    }
                ], { onConflict: 'tutor_id' });

                if (tutor_upsert.error) {
                    console.error('Error verificando tutor:', tutor_upsert.error);
                }
            }
            router.replace('/(tabs)' as any);
        }
    }

    async function signUpWithEmail() {
        if (!email || !password || !fullName) return Alert.alert('Error', 'Completa todos los campos');
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            Alert.alert('Error', error.message);
        } else if (data.session) {
            const tutor_insert = await supabase.from('tutor').insert([
                {
                    tutor_id: data.session.user.id,
                    email: data.session.user.email,
                    full_name: fullName
                }
            ]);

            if (tutor_insert.error) {
                console.error('Error al registrar tutor', tutor_insert.error);
                Alert.alert('Advertencia', 'El usuario se creó pero hubo un error en la Base de Datos. Detalles: ' + tutor_insert.error.message);
            }

            router.replace('/register-baby' as any);
        } else {
            Alert.alert('Nota', 'Usuario registrado. Intenta iniciar sesión.');
        }
        setLoading(false);
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
                <View style={styles.imageContainer}>
                    <Image
                        source={require('../assets/images/bebe.png')}
                        style={styles.babyImage}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.bottomSheet}>
                    <View style={styles.handle} />

                    <Text style={styles.title}>Crezcamos Juntos</Text>
                    <Text style={styles.subtitle}>
                        Actividades diarias para impulsar el viaje de desarrollo de tu pequeño.
                    </Text>

                    <View style={styles.formContainer}>
                        {isSignUp && (
                            <TextInput
                                label="Nombre completo"
                                value={fullName}
                                onChangeText={setFullName}
                                mode="outlined"
                                style={styles.input}
                                textColor={Colors.palette.textDark}
                                outlineColor={Colors.palette.border}
                                activeOutlineColor={Colors.palette.primary}
                                disabled={loading}
                                theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                            />
                        )}
                        <TextInput
                            label="Correo Electrónico"
                            value={email}
                            onChangeText={setEmail}
                            mode="outlined"
                            style={styles.input}
                            textColor={Colors.palette.textDark}
                            outlineColor={Colors.palette.border}
                            activeOutlineColor={Colors.palette.primary}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            disabled={loading}
                            theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                        />
                        <TextInput
                            label="Contraseña"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            mode="outlined"
                            style={styles.input}
                            textColor={Colors.palette.textDark}
                            outlineColor={Colors.palette.border}
                            activeOutlineColor={Colors.palette.primary}
                            disabled={loading}
                            theme={{ roundness: 12, colors: { primary: Colors.palette.primary, background: Colors.palette.white, text: Colors.palette.textDark } }}
                        />

                        {isSignUp ? (
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                                onPress={signUpWithEmail}
                                disabled={loading}
                            >
                                <Ionicons name="person-add" size={20} color="#fff" style={styles.buttonIcon} />
                                <Text style={styles.primaryButtonText}>
                                    {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                                onPress={signInWithEmail}
                                disabled={loading}
                            >
                                <Ionicons name="mail" size={20} color="#fff" style={styles.buttonIcon} />
                                <Text style={styles.primaryButtonText}>
                                    {loading ? 'Cargando...' : 'Iniciar sesión con Email'}
                                </Text>
                            </TouchableOpacity>
                        )}


                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {isSignUp ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? '}
                            </Text>
                            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
                                <Text style={styles.footerLink}>
                                    {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.palette.backgroundLight,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    imageContainer: {
        height: height * 0.45,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 20,
    },
    babyImage: {
        width: '100%',
        height: '100%',
    },
    bottomSheet: {
        flex: 1,
        backgroundColor: Colors.palette.white,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.palette.textDark,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.palette.textMuted,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 10,
        marginBottom: 28,
    },
    formContainer: {
        width: '100%',
    },
    input: {
        marginBottom: 16,
        backgroundColor: Colors.palette.white,
        fontSize: 15,
    },
    primaryButton: {
        backgroundColor: Colors.palette.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 30,
        paddingVertical: 14,
        marginTop: 8,
        marginBottom: 24,
        shadowColor: Colors.palette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    buttonIcon: {
        marginRight: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    footerText: {
        color: Colors.palette.textMuted,
        fontSize: 15,
    },
    footerLink: {
        color: Colors.palette.primary,
        fontSize: 15,
        fontWeight: 'bold',
    },
});

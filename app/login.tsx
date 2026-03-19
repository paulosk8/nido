import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../context/AuthContext';
import Colors from '../constants/Colors';
import { supabase } from '../lib/supabase';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
    const { setSessionManually } = useAuth();
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithGoogle() {
        setLoading(true);
        const redirectUri = AuthSession.makeRedirectUri({
            scheme: 'nido',
        });

        // Log the redirect URI for local/production debugging
        console.log('Redirect URI:', redirectUri);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUri,
                skipBrowserRedirect: true,
            },
        });

        if (error) {
            Alert.alert('Error de autenticación', error.message);
            setLoading(false);
            return;
        }

        if (data?.url) {
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
            if (result.type === 'success') {
                const { url } = result;
                await setSessionManually(url);
                router.replace('/');
            }
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
                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                            onPress={signInWithGoogle}
                            disabled={loading}
                        >
                            <Ionicons name="logo-google" size={20} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.primaryButtonText}>
                                {loading ? 'Cargando...' : 'Iniciar sesión con Google'}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.policyText}>
                            Al continuar, aceptas que cuidemos el neurodesarrollo de tu bebé con amor.
                        </Text>
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
    policyText: {
        fontSize: 13,
        color: Colors.palette.textMuted,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
        marginTop: 10,
    },
});

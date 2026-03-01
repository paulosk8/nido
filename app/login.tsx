import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, TextInput } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {

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
            // Asegurar que el tutor exista (por si el usuario ya se había creado en Auth previamente)
            if (data?.session?.user) {
                const tutor_upsert = await supabase.from('tutor').upsert([
                    {
                        tutor_id: data.session.user.id,
                        email: data.session.user.email,
                        google_id: data.session.user.id // placeholder temporal
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
        if (!email || !password) return Alert.alert('Error', 'Completa los campos');
        setLoading(true);
        // Al desactivar "Confirm Email" en Supabase, esto loguea al usuario automáticamente
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            Alert.alert('Error', error.message);
        } else if (data.session) {
            // Registrar usuario en la tabla tutor
            const tutor_insert = await supabase.from('tutor').insert([
                {
                    tutor_id: data.session.user.id,
                    email: data.session.user.email,
                    google_id: data.session.user.id // usando el ID para que coincida como placeholder para google auth si no se usa google
                }
            ]);

            if (tutor_insert.error) {
                console.error('Error al registrar tutor', tutor_insert.error);
                // Si hay un error al insertar en la tabla tutor, es importante avisar porque romperá el registro de bebés
                Alert.alert('Advertencia', 'El usuario se creó pero hubo un error en la Base de Datos. Detalles: ' + tutor_insert.error.message);
            }

            Alert.alert('Éxito', 'Cuenta creada e inicio de sesión automático.');
            router.replace('/(tabs)' as any);
        } else {
            Alert.alert('Nota', 'Usuario registrado. Intenta iniciar sesión.');
        }
        setLoading(false);
    }



    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Card style={styles.card}>
                <Card.Title title="Nido stimulation" subtitle="Acompañando su crecimiento" titleStyle={styles.title} />
                <Card.Content>
                    <TextInput
                        label="Correo Electrónico"
                        value={email}
                        onChangeText={setEmail}
                        mode="outlined"
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        disabled={loading}
                    />
                    <TextInput
                        label="Contraseña"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        mode="outlined"
                        style={styles.input}
                        disabled={loading}
                    />
                    <Button
                        mode="contained"
                        onPress={signInWithEmail}
                        loading={loading}
                        style={styles.button}

                    >
                        Entrar
                    </Button>
                    <Button
                        mode="text"
                        onPress={signUpWithEmail}
                        disabled={loading && !email.includes('@')}
                        style={styles.mainBtn}
                    >
                        Iniciar Sesión
                    </Button>
                    <Button
                        mode="text"
                        onPress={signUpWithEmail}
                        disabled={loading}
                        style={styles.txtBtn}
                    >
                        ¿Eres nuevo? Regístrate aquí
                    </Button>
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f8fafc'
    },
    card: {
        borderRadius: 24,
        padding: 10,
        elevation: 2,
        backgroundColor: '#ffffff'
    },
    title: {
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#334155'
    },
    input: {
        marginBottom: 15,
        backgroundColor: '#ffffff'
    },
    mainBtn: {
        marginTop: 10,
        paddingVertical: 6,
        borderRadius: 24,
    },
    txtBtn: {
        marginBottom: 4,
    },
    button: {
        marginTop: 10,
        paddingVertical: 5,
        borderRadius: 24
    }
});

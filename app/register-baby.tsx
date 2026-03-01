import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function RegisterBabyScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [birthDate, setBirthDate] = useState(''); // Formato YYYY-MM-DD
    const [weeks, setWeeks] = useState('40');
    const [gender, setGender] = useState('F');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name || !birthDate) return Alert.alert('Error', 'Nombre y fecha son obligatorios');

        setLoading(true);
        const parsedWeeks = parseInt(weeks);
        const isPremature = parsedWeeks < 37;

        const { error } = await supabase.from('baby').insert([{
            tutor_id: user?.id,
            name,
            birth_date: birthDate,
            weeks_gestation: parsedWeeks,
            is_premature: isPremature,
            sex: gender
        }]);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('¡Éxito!', 'Bebé registrado correctamente');
            router.replace('/(tabs)');
        }
        setLoading(false);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Card style={styles.card}>
                <Card.Title title="Nuevo Bebé" subtitle="Información de desarrollo" />
                <Card.Content>
                    <TextInput label="Nombre completo" value={name} onChangeText={setName} mode="outlined" style={styles.input} />

                    <TextInput
                        label="Fecha de Nacimiento (AAAA-MM-DD)"
                        value={birthDate}
                        onChangeText={setBirthDate}
                        mode="outlined"
                        style={styles.input}
                        placeholder="Ej: 2023-10-25"
                    />

                    <TextInput
                        label="Semanas de Gestación"
                        value={weeks}
                        onChangeText={setWeeks}
                        mode="outlined"
                        keyboardType="numeric"
                        style={styles.input}
                        placeholder="40 es un embarazo a término"
                    />

                    <Text style={styles.label}>Género:</Text>
                    <SegmentedButtons
                        value={gender}
                        onValueChange={setGender}
                        buttons={[
                            { value: 'F', label: 'Niña' },
                            { value: 'M', label: 'Niño' },
                            { value: 'O', label: 'Otro' },
                        ]}
                    />

                    <Button
                        mode="contained"
                        onPress={handleRegister}
                        loading={loading}
                        style={styles.btn}
                    >
                        Guardar Perfil
                    </Button>
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: '#fdf2f8', justifyContent: 'center' },
    card: { borderRadius: 24, padding: 10 },
    input: { marginBottom: 15 },
    label: { marginTop: 10, marginBottom: 8, fontWeight: 'bold' },
    btn: { marginTop: 25, paddingVertical: 5 }
});

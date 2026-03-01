import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Text } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ProgressTabScreen() {
    const { user, loading: authLoading } = useAuth();
    const [babies, setBabies] = useState<any[]>([]);
    const [loadingBabies, setLoadingBabies] = useState(true);
    const router = useRouter();

    const fetchBabies = async () => {
        setLoadingBabies(true);
        try {
            if (!user) return;
            const { data, error } = await supabase
                .from('baby')
                .select('*')
                .eq('tutor_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setBabies(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBabies(false);
        }
    };

    useEffect(() => {
        if (user) fetchBabies();
    }, [user]);

    if (authLoading || loadingBabies) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text variant="headlineMedium" style={styles.headerTitle}>Ver Progreso</Text>
            <Text variant="bodyLarge" style={styles.subtext}>Selecciona un bebé para ver sus estadísticas de estimulación:</Text>

            {babies.length === 0 ? (
                <Text style={styles.emptyText}>No tienes bebés registrados aún.</Text>
            ) : (
                babies.map((baby) => (
                    <Card key={baby.baby_id} style={styles.babyCard} onPress={() => router.push({ pathname: '/progress-dashboard', params: { baby_id: baby.baby_id } })}>
                        <Card.Title
                            title={baby.name}
                            subtitle="Ver Reporte"
                            left={(props) => <Avatar.Icon {...props} icon="chart-bar" style={{ backgroundColor: '#e0e7ff' }} color="#4f46e5" />}
                        />
                    </Card>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#f8fafc',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 5,
    },
    subtext: {
        color: '#64748b',
        marginBottom: 20,
    },
    babyCard: {
        borderRadius: 16,
        marginBottom: 15,
        elevation: 2,
        backgroundColor: '#ffffff'
    },
    emptyText: {
        textAlign: 'center',
        marginVertical: 30,
        color: '#94a3b8'
    }
});

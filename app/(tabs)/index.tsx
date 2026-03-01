import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Text } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const [babies, setBabies] = useState<any[]>([]);
  const [loadingBabies, setLoadingBabies] = useState(true);
  const router = useRouter();

  // 1. Proteger la ruta
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login' as any);
    }
  }, [user, authLoading]);

  // 2. Cargar bebés del tutor
  const fetchBabies = async () => {
    setLoadingBabies(true);
    try {
      const { data, error } = await supabase
        .from('baby')
        .select('*')
        .eq('tutor_id', user?.id)
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
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineMedium" style={styles.headerTitle}>Mi Familia NIDO</Text>

      {babies.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.welcome}>¡Aún no tienes bebés registrados!</Text>
            <Button mode="contained" onPress={() => router.push('/register-baby' as any)} style={styles.btn}>
              Registrar Bebé
            </Button>
          </Card.Content>
        </Card>
      ) : (
        babies.map((baby) => (
          <Card key={baby.baby_id} style={styles.babyCard} onPress={() => router.push({ pathname: '/activities-list', params: { baby_id: baby.baby_id } })}>
            <Card.Title
              title={baby.name}
              subtitle={`Nacido el: ${baby.birth_date}`}
              left={(props) => <Avatar.Icon {...props} icon="baby-face-outline" />}
            />
            <Card.Content>
              <View style={styles.babyTextContainer}>
                <Text style={styles.babyDetail}>Semanas Gestación: {baby.weeks_gestation}</Text>
                {baby.is_premature && <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Bebé Prematuro</Text>}
              </View>
            </Card.Content>
          </Card>
        ))
      )}

      {babies.length > 0 && (
        <Button mode="outlined" onPress={() => router.push('/register-baby' as any)} style={{ marginTop: 15 }}>
          Añadir otro bebé
        </Button>
      )}

      <Button mode="text" onPress={() => supabase.auth.signOut()} style={styles.btnOut}>
        Cerrar Sesión
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8fafc', // Very light background
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
    color: '#334155'
  },
  card: {
    borderRadius: 24, // Softer curves
    elevation: 2,
    marginTop: 20,
    backgroundColor: '#ffffff'
  },
  babyCard: {
    borderRadius: 24,
    marginBottom: 15,
    elevation: 2,
    backgroundColor: '#ffffff'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20
  },
  welcome: {
    marginVertical: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#64748b'
  },
  btn: {
    marginTop: 20,
    width: '100%',
    borderRadius: 24 // rounded button
  },
  btnOut: {
    marginTop: 40
  },
  babyTextContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 12
  },
  babyDetail: {
    color: '#475569',
    marginBottom: 4
  }
});
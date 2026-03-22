import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BabyProvider, useBaby } from '../context/BabyContext';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

function ProtectedRoot() {
  const { user, loading: authLoading } = useAuth();
  const { babies, loadingBabies } = useBaby();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Solo redirigir si el sistema está listo
    if (authLoading || loadingBabies || !segments) return;

    const inAuthGroup = segments[0] === 'login';
    const inRegistry = segments[0] === 'register-baby';

    // Delay de seguridad para evitar conflicto con la animación de entrada nativa
    const timeout = setTimeout(() => {
      if (!user && !inAuthGroup) {
        router.replace('/login');
      } else if (user) {
        if (babies.length === 0 && !inRegistry) {
          router.replace('/register-baby');
        } else if (babies.length > 0 && inAuthGroup) {
          router.replace('/');
        }
      }
    }, 50);

    return () => clearTimeout(timeout);
  }, [user, authLoading, loadingBabies, babies, segments]);

  return (
    <View style={{ flex: 1 }}>
      {/* 
        El Stack siempre renderiza los contenedores de navegación, 
        evitando que router.replace se llame sobre un navigator inexistente
      */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register-baby" />
      </Stack>

      {/* Overlay de carga mientras los contextos de Supabase se inicializan */}
      {(authLoading || loadingBabies) && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999
  }
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <BabyProvider>
        <PaperProvider>
          <ProtectedRoot />
        </PaperProvider>
      </BabyProvider>
    </AuthProvider>
  );
}
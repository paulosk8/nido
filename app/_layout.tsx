import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BabyProvider, useBaby } from '../context/BabyContext';
import { useEffect } from 'react';
import { View } from 'react-native';

function ProtectedRoot() {
  const { user, loading: authLoading } = useAuth();
  const { babies, loadingBabies } = useBaby();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || loadingBabies) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Not logged in, redirect to login
      router.replace('/login');
    } else if (user) {
      if (babies.length === 0 && segments[0] !== 'register-baby') {
        // Logged in but no babies, go to register-baby
        router.replace('/register-baby');
      } else if (babies.length > 0 && inAuthGroup) {
        // Logged in and has babies, but on login screen, go to main
        router.replace('/');
      }
    }
  }, [user, authLoading, loadingBabies, babies, segments]);

  if (authLoading || loadingBabies) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register-baby" />
    </Stack>
  );
}

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
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<{
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSessionManually: (url: string) => Promise<void>;
}>({ 
  session: null, 
  user: null, 
  loading: true, 
  setSessionManually: async () => {} 
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 1.5 Handle deep links for OAuth redirects
  const handleDeepLink = async (url: string) => {
    let access_token: string | null = null;
    let refresh_token: string | null = null;

    if (url.includes('#')) {
      const hash = url.split('#')[1];
      const params = new URLSearchParams(hash);
      access_token = params.get('access_token');
      refresh_token = params.get('refresh_token');
    } else if (url.includes('?')) {
      const parsed = Linking.parse(url);
      access_token = parsed.queryParams?.access_token as string;
      refresh_token = parsed.queryParams?.refresh_token as string;
    }

    if (access_token && refresh_token) {
      setLoading(true);
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) console.error('Error setting session from deep link:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Obtener sesión inicial
    const initSession = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await handleDeepLink(initialUrl);
        }

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error("Error recuperando sesión:", error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // 2. Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Upsert tutor profile
        supabase.from('tutor').upsert([
          {
            tutor_id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Tutor'
          }
        ], { onConflict: 'tutor_id' }).then(({ error }) => {
          if (error) console.error('Error upserting tutor in AuthContext:', error);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading, setSessionManually: handleDeepLink }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
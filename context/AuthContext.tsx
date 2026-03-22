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
    let isMounted = true;

    // Helper para sincronizar el perfil del tutor y re-vincular bebés si es necesario
    const syncProfile = async (sessionUser: User) => {
      const performSync = async () => {
        try {
          const { error } = await supabase.from('tutor').upsert([
            {
              tutor_id: sessionUser.id,
              email: sessionUser.email,
              full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Tutor'
            }
          ], { onConflict: 'tutor_id' });

          if (error && error.code === '23505' && error.message.includes('tutor_email_key')) {
            const { data: oldTutor } = await supabase.from('tutor').select('tutor_id').eq('email', sessionUser.email).single();
            if (oldTutor && oldTutor.tutor_id !== sessionUser.id) {
              await supabase.from('baby').update({ tutor_id: sessionUser.id }).eq('tutor_id', oldTutor.tutor_id);
              await supabase.from('tutor').delete().eq('tutor_id', oldTutor.tutor_id);
              await supabase.from('tutor').upsert([{
                tutor_id: sessionUser.id,
                email: sessionUser.email,
                full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Tutor'
              }]);
            }
          }
        } catch (err) {
          console.error('Error en syncProfile async:', err);
        }
      };

      // Si la sincronización tarda más de 5 segundos, liberamos la UI por seguridad
      await Promise.race([
        performSync(),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
    };

    // 1. Obtener sesión inicial
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await syncProfile(initialSession.user);
          }
        }
      } catch (error) {
        console.error("Error recuperando sesión:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // 2. Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' && currentSession?.user) {
        setLoading(true);
        await syncProfile(currentSession.user).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading, setSessionManually: handleDeepLink }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
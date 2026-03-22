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

    // 2. Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Aseguramos que el perfil y los bebés estén vinculados ANTES de liberar la pantalla de carga
        try {
          const { error } = await supabase.from('tutor').upsert([
            {
              tutor_id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Tutor'
            }
          ], { onConflict: 'tutor_id' });

          if (error) {
            console.error('Error upserting tutor in AuthContext:', error);
            // Manejo de cuentas huérfanas: el email ya existe en otro tutor_id (caso desarrollo)
            if (error.code === '23505' && error.message.includes('tutor_email_key')) {
              const { data: oldTutor } = await supabase.from('tutor').select('tutor_id').eq('email', session.user.email).single();
              
              if (oldTutor && oldTutor.tutor_id !== session.user.id) {
                console.log('Cuenta huérfana detectada. Re-vinculando bebés...');
                // 1. Re-vincular bebés al nuevo tutor_id
                await supabase.from('baby').update({ tutor_id: session.user.id }).eq('tutor_id', oldTutor.tutor_id);
                // 2. Borrar tutor antiguo
                await supabase.from('tutor').delete().eq('tutor_id', oldTutor.tutor_id);
                // 3. Re-intentar upsert
                await supabase.from('tutor').upsert([{
                  tutor_id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Tutor'
                }]);
              }
            }
          }
        } catch (syncErr) {
          console.error('Error sincronizando perfil en Auth:', syncErr);
        }
      }

      setLoading(false);
    });

    return () => {
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
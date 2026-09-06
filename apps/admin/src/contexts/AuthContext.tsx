import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import i18n, { applyDirection } from '../lib/i18n';

export type UserRole = 'super_admin' | 'transport_admin' | 'driver';

export interface AppUserProfile {
  id: string;
  school_id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  preferred_language: 'en' | 'ar';
  is_active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: AppUserProfile | null;
  status: 'loading' | 'signed_out' | 'signed_in' | 'inactive';
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, school_id, role, full_name, email, preferred_language, is_active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as AppUserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  useEffect(() => {
    let unsubscribed = false;

    async function hydrate(nextSession: Session | null) {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setStatus('signed_out');
        return;
      }
      const p = await fetchProfile(nextSession.user.id);
      if (unsubscribed) return;
      if (!p) {
        // Auth user exists but has no linked `users` row — treat as signed out
        // rather than granting an unscoped session.
        setProfile(null);
        setStatus('signed_out');
        return;
      }
      if (!p.is_active) {
        setProfile(p);
        setStatus('inactive');
        return;
      }
      setProfile(p);
      setStatus('signed_in');
      if (i18n.language !== p.preferred_language) {
        i18n.changeLanguage(p.preferred_language);
      } else {
        applyDirection(p.preferred_language);
      }
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      hydrate(nextSession);
    });

    return () => {
      unsubscribed = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

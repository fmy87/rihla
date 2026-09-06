import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface DriverProfile {
  id: string; // drivers.id
  school_id: string;
  full_name: string;
  employee_id: string;
  photo_url: string | null;
  preferred_language: 'en' | 'ar';
  is_active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  driver: DriverProfile | null;
  status: 'loading' | 'signed_out' | 'signed_in' | 'inactive';
  signInWithEmployeeId: (schoolId: string, employeeId: string, pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchDriverProfile(userId: string): Promise<DriverProfile | null> {
  // Joins through users -> drivers via drivers.user_id, since role/session
  // identity lives in `users` (shared with the admin app) but operational
  // driver data (employee_id, photo, license) lives in `drivers`.
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, school_id, role, preferred_language, is_active')
    .eq('id', userId)
    .single();
  if (userError || !userRow || userRow.role !== 'driver') return null;

  const { data: driverRow, error: driverError } = await supabase
    .from('drivers')
    .select('id, school_id, full_name, employee_id, photo_url, is_active')
    .eq('user_id', userId)
    .single();
  if (driverError || !driverRow) return null;

  return {
    id: driverRow.id,
    school_id: driverRow.school_id,
    full_name: driverRow.full_name,
    employee_id: driverRow.employee_id,
    photo_url: driverRow.photo_url,
    preferred_language: userRow.preferred_language,
    is_active: userRow.is_active && driverRow.is_active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  useEffect(() => {
    let unsubscribed = false;

    async function hydrate(nextSession: Session | null) {
      setSession(nextSession);
      if (!nextSession) {
        setDriver(null);
        setStatus('signed_out');
        return;
      }
      const profile = await fetchDriverProfile(nextSession.user.id);
      if (unsubscribed) return;
      if (!profile) {
        setDriver(null);
        setStatus('signed_out');
        return;
      }
      setDriver(profile);
      setStatus(profile.is_active ? 'signed_in' : 'inactive');
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => hydrate(s));
    return () => {
      unsubscribed = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithEmployeeId(schoolId: string, employeeId: string, pin: string) {
    const { data: loginEmail, error: lookupError } = await supabase.rpc('resolve_driver_login_email', {
      p_school_id: schoolId,
      p_employee_id: employeeId,
    });
    if (lookupError || !loginEmail) {
      return { error: 'invalid_credentials' };
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail as string,
      password: pin,
    });
    if (signInError) return { error: 'invalid_credentials' };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, driver, status, signInWithEmployeeId, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSupabaseClient, isSupabaseConfigured } from '@/services/supabase';

type SessionContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn('[BodyFuel auth] Session konnte nicht geladen werden:', error.message);
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ configured: isSupabaseConfigured, loading, user: session?.user ?? null, signIn, signOut }),
    [loading, session, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession muss innerhalb des SessionProvider verwendet werden.');
  return value;
}

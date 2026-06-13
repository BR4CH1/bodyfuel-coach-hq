import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { CLIENTS, findClient, type Client, type DailyCheck, todayKey } from "./data";

export type Profile = {
  id: string;
  display_name: string | null;
  demo_client_key: string | null;
};

type SessionCtx = {
  user: Client | null;
  isCoach: boolean;
  supabaseUser: User | null;
  profile: Profile | null;
  loading: boolean;
  groups: string[];
  hasGroup: (g: string) => boolean;
  loginAs: (id: string, coach?: boolean) => void;
  logout: () => Promise<void>;
  updateTodayCheck: (tasks: DailyCheck["tasks"]) => void;
};

const Ctx = createContext<SessionCtx | null>(null);

const KEY = "bodyfuel.session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [demoCoach, setDemoCoach] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"coach" | "client" | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // hydrate demo
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setDemoUserId(s.userId);
        setDemoCoach(!!s.isCoach);
      }
    } catch {}
  }, []);

  // hydrate supabase
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setRole(null);
        setGroups([]);
      } else {
        // defer DB reads off the callback
        setTimeout(() => loadProfile(session.user.id), 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSupabaseUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid: string) => {
    const [p, r, g] = await Promise.all([
      supabase.from("profiles").select("id, display_name, demo_client_key").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_groups").select("group_name").eq("user_id", uid),
    ]);
    if (p.data) {
      setProfile(p.data as Profile);
      if (p.data.demo_client_key && !demoUserId) {
        setDemoUserId(p.data.demo_client_key);
      }
    }
    if (g.data) {
      setGroups(g.data.map((x: any) => x.group_name as string));
    }
    if (r.data) {
      const isCoach = r.data.some((x) => x.role === "coach");
      setRole(isCoach ? "coach" : "client");
      if (isCoach) {
        setDemoCoach(true);
      } else {
        setDemoCoach(false);
        persist(p.data?.demo_client_key ?? uid, false);
      }
    }
  };

  const persist = (id: string | null, coach: boolean) => {
    if (id) localStorage.setItem(KEY, JSON.stringify({ userId: id, isCoach: coach }));
    else localStorage.removeItem(KEY);
  };

  const effectiveUser = demoUserId ? findClient(demoUserId) ?? null : null;
  const effectiveCoach = demoCoach || role === "coach";

  const value: SessionCtx = {
    user: effectiveUser,
    isCoach: effectiveCoach,
    supabaseUser,
    profile,
    loading,
    groups,
    hasGroup: (gname: string) => groups.includes(gname),
    loginAs: (id, coach = false) => {
      setDemoUserId(id);
      setDemoCoach(coach);
      persist(id, coach);
    },
    logout: async () => {
      setDemoUserId(null);
      setDemoCoach(false);
      persist(null, false);
      await supabase.auth.signOut();
    },
    updateTodayCheck: (tasks) => {
      const u = demoUserId ? findClient(demoUserId) : null;
      if (!u) return;
      const today = todayKey();
      const idx = u.checks.findIndex((c) => c.date === today);
      if (idx >= 0) u.checks[idx] = { date: today, tasks };
      else u.checks.unshift({ date: today, tasks });
      setTick((t) => t + 1);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be inside SessionProvider");
  return c;
}

export { CLIENTS };

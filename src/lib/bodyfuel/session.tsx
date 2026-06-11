import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CLIENTS, findClient, type Client, type DailyCheck, todayKey } from "./data";

type SessionCtx = {
  user: Client | null;
  isCoach: boolean;
  loginAs: (id: string, coach?: boolean) => void;
  logout: () => void;
  updateTodayCheck: (tasks: DailyCheck["tasks"]) => void;
};

const Ctx = createContext<SessionCtx | null>(null);

const KEY = "bodyfuel.session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setUserId(s.userId);
        setIsCoach(!!s.isCoach);
      }
    } catch {}
  }, []);

  const persist = (id: string | null, coach: boolean) => {
    if (id) localStorage.setItem(KEY, JSON.stringify({ userId: id, isCoach: coach }));
    else localStorage.removeItem(KEY);
  };

  const value: SessionCtx = {
    user: userId ? findClient(userId) ?? null : null,
    isCoach,
    loginAs: (id, coach = false) => {
      setUserId(id);
      setIsCoach(coach);
      persist(id, coach);
    },
    logout: () => {
      setUserId(null);
      setIsCoach(false);
      persist(null, false);
    },
    updateTodayCheck: (tasks) => {
      const u = userId ? findClient(userId) : null;
      if (!u) return;
      const today = todayKey();
      const idx = u.checks.findIndex((c) => c.date === today);
      if (idx >= 0) u.checks[idx] = { date: today, tasks };
      else u.checks.unshift({ date: today, tasks });
      setTick((t) => t + 1);
    },
  };

  // Force re-render reference (tick used to bust memo)
  void tick;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be inside SessionProvider");
  return c;
}

export { CLIENTS };

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Trophy, Flame, Star, Sparkles, Crown, Medal, Check } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  trigger_type: string;
  threshold: number;
  reward_points: number;
  sort_order: number;
};

type UserPoints = {
  total_points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  flame: Flame,
  star: Star,
  sparkles: Sparkles,
  crown: Crown,
  medal: Medal,
  check: Check,
};

function IconFor({ name, className }: { name: string; className?: string }) {
  const Cmp = ICON_MAP[name] ?? Trophy;
  return <Cmp className={className} />;
}

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Erfolge — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <AchievementsContent />
    </AppLayout>
  ),
});

function progressFor(a: Achievement, points: UserPoints): { progress: number; total: number } {
  const total = Math.max(1, a.threshold || 1);
  switch (a.trigger_type) {
    case "total_points":
      return { progress: Math.min(points.total_points, total), total };
    case "streak":
      return { progress: Math.min(points.current_streak, total), total };
    case "level":
      return { progress: Math.min(points.level, total), total };
    case "first_check":
    case "perfect_day":
    case "perfect_week":
    default:
      return { progress: 0, total: 1 };
  }
}

function AchievementsContent() {
  const { supabaseUser, loading: sessionLoading } = useSession();
  const [all, setAll] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState<UserPoints>({
    total_points: 0,
    level: 1,
    current_streak: 0,
    longest_streak: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const [{ data: achs }, { data: ua }, { data: pts }] = await Promise.all([
        supabase.from("achievements").select("*").order("sort_order"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", supabaseUser.id),
        supabase
          .from("user_points")
          .select("total_points, level, current_streak, longest_streak")
          .eq("user_id", supabaseUser.id)
          .maybeSingle(),
      ]);
      setAll((achs ?? []) as Achievement[]);
      setUnlocked(new Set((ua ?? []).map((r) => r.achievement_id)));
      if (pts) setPoints(pts as UserPoints);
      setLoading(false);
    })();
  }, [supabaseUser]);

  if (sessionLoading || loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Lade Erfolge…
      </div>
    );
  }

  if (!supabaseUser) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Bitte einloggen, um deine Erfolge zu sehen.
      </div>
    );
  }

  const done = all.filter((a) => unlocked.has(a.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Erfolge</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {done} / {all.length} freigeschaltet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Level {points.level} · {points.total_points} Punkte · {points.current_streak} Tage Streak
        </p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Noch keine Erfolge verfügbar.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((a) => {
            const isDone = unlocked.has(a.id);
            const { progress, total } = progressFor(a, points);
            const pct = isDone ? 100 : Math.round((progress / total) * 100);
            return (
              <div
                key={a.id}
                className={`relative overflow-hidden rounded-2xl border p-5 transition ${
                  isDone
                    ? "border-gold/50 bg-card shadow-gold"
                    : "border-border bg-card opacity-90"
                }`}
              >
                {isDone && (
                  <div className="absolute right-3 top-3 rounded-full bg-gradient-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Erreicht
                  </div>
                )}
                <div
                  className={`grid h-16 w-16 place-items-center rounded-2xl ${
                    isDone ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isDone ? <IconFor name={a.icon} className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{a.title}</h3>
                <p className="text-xs text-muted-foreground">{a.description}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fortschritt</span>
                    <span className="font-semibold">
                      {isDone ? total : progress} / {total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isDone ? "bg-gradient-gold" : "bg-muted-foreground/50"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

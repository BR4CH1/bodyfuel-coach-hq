import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Droplet, Apple, Scale, Activity, Trophy, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/tracker/app/")({
  head: () => ({ meta: [{ title: "Heute — BodyFuel Tracker" }] }),
  component: TrackerHome,
});

function TrackerHome() {
  const { supabaseUser, profile } = useSession();
  const [stats, setStats] = useState<{ total: number; streak: number; level: number } | null>(null);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data } = await supabase
        .from("user_points")
        .select("total_points, current_streak, level")
        .eq("user_id", supabaseUser.id)
        .maybeSingle();
      setStats({
        total: data?.total_points ?? 0,
        streak: data?.current_streak ?? 0,
        level: data?.level ?? 1,
      });
    })();
  }, [supabaseUser]);

  const xp = stats?.total ?? 0;
  const xpInLevel = xp % 100;
  const name = profile?.display_name?.split(" ")[0] ?? "Athlet";

  const tiles = [
    { to: "/tracker/app/nutrition", label: "Ernährung", icon: Apple, desc: "Kalorien & Makros" },
    { to: "/tracker/app/water", label: "Wasser", icon: Droplet, desc: "Tagesziel" },
    { to: "/tracker/app/weight", label: "Gewicht", icon: Scale, desc: "Verlauf" },
    { to: "/tracker/app/activity", label: "Aktivität", icon: Activity, desc: "Schritte & Training" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Heute</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Hi {name} 👋</h1>
      </div>

      {/* Level / Streak */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Level</p>
          <p className="mt-1 font-display text-3xl font-bold text-primary">{stats?.level ?? 1}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-gradient-gold" style={{ width: `${xpInLevel}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{xpInLevel} / 100 XP zum nächsten Level</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Streak</p>
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-bold">
            <Flame className="h-7 w-7 text-primary" /> {stats?.streak ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Tage in Folge aktiv</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gesamt-XP</p>
          <p className="mt-1 font-display text-3xl font-bold">{xp}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">durch tägliches Tracking</p>
        </div>
      </div>

      {/* Tracking-Tiles */}
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-display text-lg font-bold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          );
        })}
      </div>

      <Link
        to="/tracker/app/achievements"
        className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 hover:border-primary/50"
      >
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold">Achievements & Erfolge ansehen</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

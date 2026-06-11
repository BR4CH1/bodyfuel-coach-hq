import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Target, Calendar, TrendingUp, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getLevel,
  totalPoints,
  todayPoints,
  weekPoints,
  MAX_DAILY_POINTS,
  lastNDays,
  pointsForDay,
} from "@/lib/bodyfuel/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  ),
});

function DashboardContent() {
  const { user } = useSession();
  if (!user) return null;

  const points = totalPoints(user);
  const { level, next, progress } = getLevel(points);
  const today = todayPoints(user);
  const week = weekPoints(user);

  const lastWeek = lastNDays(7)
    .reverse()
    .map((d) => ({
      date: d,
      label: new Date(d).toLocaleDateString("de-DE", { weekday: "short" }),
      points: pointsForDay(user.checks.find((c) => c.date === d)),
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Willkommen zurück
          </p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Hey {user.name.split(" ")[0]} 👋
          </h1>
        </div>
        <Link
          to="/check-in"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90"
        >
          Tagescheck starten <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Level hero card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
              <Flame className="h-3.5 w-3.5" /> Aktuelles Level
            </div>
            <div className="mt-1 font-display text-5xl font-bold text-gradient-gold sm:text-6xl">
              {level.name}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {next ? (
                <>
                  Noch <span className="font-semibold text-foreground">{next.min - points}</span>{" "}
                  Punkte bis <span className="text-gold">{next.name}</span>
                </>
              ) : (
                "Max Level erreicht — Legendary!"
              )}
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{level.name}</span>
                <span className="font-semibold text-foreground">{points} Pkt</span>
                <span className="text-muted-foreground">{next ? next.name : "MAX"}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-2">
            <Stat label="Gesamt" value={points} suffix="Pkt" />
            <Stat label="Heute" value={today} suffix={`/ ${MAX_DAILY_POINTS}`} />
            <Stat
              label="Streak"
              value={user.streak}
              suffix="Tage"
              accent={user.streak > 0}
            />
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<Target className="h-5 w-5" />}
          label="Heute"
          value={`${today} / ${MAX_DAILY_POINTS}`}
          hint="Tagespunkte"
        />
        <Card
          icon={<TrendingUp className="h-5 w-5" />}
          label="Diese Woche"
          value={`${week}`}
          hint={`Ø ${(week / 7).toFixed(1)} / Tag`}
        />
        <Card
          icon={<Flame className="h-5 w-5" />}
          label="Streak"
          value={`${user.streak} Tage`}
          hint={user.streak >= 14 ? "🔥 On Fire" : "Keep going"}
        />
        <Card
          icon={<Calendar className="h-5 w-5" />}
          label="Nächster Check-in"
          value={user.nextCheckIn}
          hint="Erinnerung aktiv"
        />
      </div>

      {/* Last 7 days */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Letzte 7 Tage</h2>
          <span className="text-xs text-muted-foreground">Punkte pro Tag</span>
        </div>
        <div className="flex items-end justify-between gap-2 sm:gap-3">
          {lastWeek.map((d) => {
            const h = (d.points / MAX_DAILY_POINTS) * 100;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end overflow-hidden rounded-md bg-secondary/60">
                  <div
                    className="w-full bg-gradient-gold transition-all"
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={`${d.points} Pkt`}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {d.label}
                </div>
                <div className="text-xs font-semibold text-foreground">{d.points}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">
        <span className={accent ? "text-gold" : ""}>{value}</span>
        {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-gold">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

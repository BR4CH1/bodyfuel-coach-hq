import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Target, Calendar, TrendingUp, ArrowRight, Scale, Plus, CalendarCheck, ListChecks } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { MyPackagePanel } from "@/components/bodyfuel/MyPackagePanel";
import { TrainingDevelopmentCard } from "@/components/bodyfuel/TrainingTrends";
import { DailyChecklist } from "@/components/bodyfuel/DailyChecklist";
import { AchievementsCard } from "@/components/bodyfuel/AchievementsCard";

import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
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
  const { user, supabaseUser } = useSession();
  const [dbPoints, setDbPoints] = useState<{ total: number; today: number; streak: number } | null>(null);

  useEffect(() => {
    if (!supabaseUser) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: up }, { data: dc }] = await Promise.all([
        supabase
          .from("user_points")
          .select("total_points, current_streak")
          .eq("user_id", supabaseUser.id)
          .maybeSingle(),
        supabase
          .from("daily_checks")
          .select("points")
          .eq("user_id", supabaseUser.id)
          .eq("check_date", today)
          .maybeSingle(),
      ]);
      setDbPoints({
        total: up?.total_points ?? 0,
        today: dc?.points ?? 0,
        streak: up?.current_streak ?? 0,
      });
    })();
  }, [supabaseUser]);

  if (!user) return <RealUserDashboard />;

  const points = dbPoints?.total ?? totalPoints(user);
  const { level, next, progress } = getLevel(points);
  const today = dbPoints?.today ?? todayPoints(user);
  const streak = dbPoints?.streak ?? user.streak;
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

      {today < MAX_DAILY_POINTS && (
        <Link
          to="/daily-checklist"
          className="group flex items-center justify-between rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5 transition hover:border-gold/70"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gold">Tagescheck offen</div>
              <div className="font-display text-base font-bold">
                Noch {MAX_DAILY_POINTS - today} von {MAX_DAILY_POINTS} Punkten heute
              </div>
              <div className="text-xs text-muted-foreground">Hak deine Tagesziele ab — Streak nicht reißen lassen!</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gold transition group-hover:translate-x-1" />
        </Link>
      )}

      {supabaseUser && <PendingPaymentBanner userId={supabaseUser.id} />}
      {supabaseUser && <MyPackagePanel />}


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
          <Link to="/daily-checklist" className="contents">
            <Stat label="Heute" value={today} suffix={`/ ${MAX_DAILY_POINTS}`} />
          </Link>
            <Stat
              label="Streak"
              value={streak}
              suffix="Tage"
              accent={streak > 0}
            />
          </div>
        </div>
      </div>


      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/daily-checklist" className="contents">
          <Card
            icon={<Target className="h-5 w-5" />}
            label="Heute"
            value={`${today} / ${MAX_DAILY_POINTS}`}
            hint="Tagespunkte"
          />
        </Link>
        <Card
          icon={<TrendingUp className="h-5 w-5" />}
          label="Diese Woche"
          value={`${week}`}
          hint={`Ø ${(week / 7).toFixed(1)} / Tag`}
        />
        <Card
          icon={<Flame className="h-5 w-5" />}
          label="Streak"
          value={`${streak} Tage`}
          hint={streak >= 14 ? "🔥 On Fire" : "Keep going"}
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

type LatestMeasurement = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

function RealUserDashboard() {
  const { supabaseUser, profile } = useSession();
  const [latest, setLatest] = useState<LatestMeasurement | null>(null);
  const [count, setCount] = useState(0);
  const [todayDbPoints, setTodayDbPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data, count: c } = await supabase
        .from("body_measurements")
        .select("measured_at, weight_kg, body_fat_pct", { count: "exact" })
        .eq("user_id", supabaseUser.id)
        .order("measured_at", { ascending: false })
        .limit(1);
      setLatest((data?.[0] as LatestMeasurement | undefined) ?? null);
      setCount(c ?? 0);

      const { data: checkData } = await supabase
        .from("daily_checks")
        .select("points")
        .eq("user_id", supabaseUser.id)
        .eq("check_date", todayStr)
        .maybeSingle();
      setTodayDbPoints(checkData?.points ?? 0);

      setLoading(false);
    })();
  }, [supabaseUser, todayStr]);

  const name = profile?.display_name?.split(" ")[0] ?? supabaseUser?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Willkommen
          </p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Hey {name} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pflege deine Körpermaße, damit dein Coach deinen Fortschritt sieht.
          </p>
        </div>
        <Link
          to="/measurements"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Messung eintragen
        </Link>
      </div>

      {todayDbPoints < MAX_DAILY_POINTS && (
        <Link
          to="/daily-checklist"
          className="group flex items-center justify-between rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5 transition hover:border-gold/70"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gold">Tagescheck offen</div>
              <div className="font-display text-base font-bold">
                Noch {MAX_DAILY_POINTS - todayDbPoints} von {MAX_DAILY_POINTS} Punkten heute
              </div>
              <div className="text-xs text-muted-foreground">Hak deine Tagesziele ab — Streak nicht reißen lassen!</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gold transition group-hover:translate-x-1" />
        </Link>
      )}

      <MyPackagePanel />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<Scale className="h-5 w-5" />}
          label="Aktuelles Gewicht"
          value={latest?.weight_kg ? `${latest.weight_kg} kg` : "—"}
          hint={
            latest
              ? `Stand ${new Date(latest.measured_at).toLocaleDateString("de-DE")}`
              : "Noch keine Messung"
          }
        />
        <Card
          icon={<TrendingUp className="h-5 w-5" />}
          label="Körperfett"
          value={latest?.body_fat_pct ? `${latest.body_fat_pct} %` : "—"}
          hint={latest ? "Letzte Messung" : "Noch keine Messung"}
        />
        <Card
          icon={<Calendar className="h-5 w-5" />}
          label="Einträge gesamt"
          value={`${count}`}
          hint="Verlauf"
        />
        <Link to="/daily-checklist" className="contents">
          <Card
            icon={<Target className="h-5 w-5" />}
            label="Heute"
            value={`${todayDbPoints} / ${MAX_DAILY_POINTS}`}
            hint="Tagespunkte"
          />
        </Link>
      </div>

      <Link
        to="/check-in"
        className="group flex items-center justify-between rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-5 transition hover:border-gold/60"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gold">Wochen-Check-in</div>
            <div className="font-display text-base font-bold">Diese Woche eintragen</div>
            <div className="text-xs text-muted-foreground">Maße, Stimmung, Erfolge & Hürden</div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-gold transition group-hover:translate-x-1" />
      </Link>

      {supabaseUser && <DailyChecklist userId={supabaseUser.id} />}

      {supabaseUser && <AchievementsCard userId={supabaseUser.id} />}

      {supabaseUser && <TrainingDevelopmentCard clientId={supabaseUser.id} />}



      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-gold">
          <Target className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Nächster Schritt</span>
        </div>
        <h2 className="mt-2 font-display text-xl font-bold">
          {loading
            ? "…"
            : count === 0
            ? "Lege deine Startwerte an"
            : "Halte deine Maße aktuell"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {count === 0
            ? "Trage Größe, Geburtsdatum und deine erste Messung ein."
            : "Trage einmal pro Woche neue Werte ein, um deinen Fortschritt zu sehen."}
        </p>
        <Link
          to="/measurements"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          Zu meinen Körpermaßen <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function PendingPaymentBanner({ userId }: { userId: string }) {
  const [pending, setPending] = useState<
    { id: string; amount_eur: number | string; note: string | null }[]
  >([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_history")
        .select("id, amount_eur, note")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setPending((data as any) ?? []);
    })();
  }, [userId]);

  if (pending.length === 0) return null;
  const total = pending.reduce((s, p) => s + Number(p.amount_eur), 0);
  const paypalUrl = `https://www.paypal.me/ManuSchrader/${total}EUR`;

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/15 to-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            💳
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gold">
              Zahlung ausstehend
            </div>
            <div className="font-display text-base font-bold">
              Dein Coach hat deine Anfrage freigegeben
            </div>
            <div className="text-xs text-muted-foreground">
              {pending.map((p) => p.note).filter(Boolean).join(" · ") ||
                "Bitte begleiche den offenen Betrag, damit dein Paket aktiviert/verlängert wird."}
            </div>
            <div className="mt-1 font-display text-lg text-gold">
              {total.toFixed(2)} €
            </div>
          </div>
        </div>
        <a
          href={paypalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold hover:opacity-90"
        >
          Jetzt mit PayPal zahlen
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

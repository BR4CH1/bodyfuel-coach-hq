import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Target, Calendar, TrendingUp, ArrowRight, Scale, Plus, CalendarCheck, ListChecks, Dumbbell } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { MyPackagePanel } from "@/components/bodyfuel/MyPackagePanel";
import { TrainingDevelopmentCard } from "@/components/bodyfuel/TrainingTrends";
import { DailyChecklist } from "@/components/bodyfuel/DailyChecklist";
import { AchievementsCard } from "@/components/bodyfuel/AchievementsCard";
import { TrainingBonusCard } from "@/components/bodyfuel/TrainingBonusCard";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { SmartAnalysisCTA } from "@/components/bodyfuel/SmartAnalysisCTA";
import { StrengthCheckStatus } from "@/components/bodyfuel/StrengthCheckStatus";
import { DailyMacroSummary } from "@/components/bodyfuel/DailyMacroSummary";
import { PointsBreakdownCard } from "@/components/bodyfuel/PointsBreakdownCard";
import { TrialStatusBanner, TrialWelcomeDialog } from "@/components/bodyfuel/Trial";
import { TrialChecklist } from "@/components/bodyfuel/TrialChecklist";
import { SportWeekdaysPrompt } from "@/components/bodyfuel/SportWeekdaysPrompt";

import { useTrial } from "@/hooks/use-trial";

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
  const { user, supabaseUser, profile } = useSession();
  const greetingName =
    profile?.display_name?.split(" ")[0] ??
    supabaseUser?.email?.split("@")[0] ??
    user?.name.split(" ")[0] ??
    "";
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
      <TrialWelcomeDialog />
      <TrialStatusBanner />
      <SportWeekdaysPrompt />
      {supabaseUser && <TrialChecklistGate userId={supabaseUser.id} />}


      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Willkommen zurück
          </p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Hey {greetingName} 👋
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

      {supabaseUser && <PointsBreakdownCard userId={supabaseUser.id} />}

      {supabaseUser && <TrainingBonusCard userId={supabaseUser.id} />}


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
  const [nextCheckin, setNextCheckin] = useState<string | null>(null);
  const [checkinMissingMeasures, setCheckinMissingMeasures] = useState(false);
  const [trainedToday, setTrainedToday] = useState(false);
  const [measuredToday, setMeasuredToday] = useState(false);
  const [userPts, setUserPts] = useState<{
    total: number;
    daily: number;
    perf: number;
    streak: number;
    longest: number;
    level: number;
  }>({ total: 0, daily: 0, perf: 0, streak: 0, longest: 0, level: 1 });
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
      const latestRow = (data?.[0] as LatestMeasurement | undefined) ?? null;
      setLatest(latestRow);
      setCount(c ?? 0);
      setMeasuredToday(!!latestRow && latestRow.measured_at.slice(0, 10) === todayStr);

      const { data: checkData } = await supabase
        .from("daily_checks")
        .select("points")
        .eq("user_id", supabaseUser.id)
        .eq("check_date", todayStr)
        .maybeSingle();
      setTodayDbPoints(checkData?.points ?? 0);

      const { data: up } = await supabase
        .from("user_points")
        .select("total_points, daily_points, performance_points, current_streak, longest_streak, level")
        .eq("user_id", supabaseUser.id)
        .maybeSingle();
      setUserPts({
        total: up?.total_points ?? 0,
        daily: up?.daily_points ?? 0,
        perf: up?.performance_points ?? 0,
        streak: up?.current_streak ?? 0,
        longest: up?.longest_streak ?? 0,
        level: up?.level ?? 1,
      });

      const { data: prof } = await supabase
        .from("profiles")
        .select("next_checkin_date")
        .eq("id", supabaseUser.id)
        .maybeSingle();
      setNextCheckin((prof as any)?.next_checkin_date ?? null);

      // Detect: did the user submit this week's check-in but leave the Maße empty?
      const mondayStr = (() => {
        const d = new Date(todayStr + "T00:00:00");
        const day = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - day);
        return d.toISOString().slice(0, 10);
      })();
      const { data: thisWeekCi } = await supabase
        .from("weekly_checkins")
        .select("waist_cm, chest_cm, hip_cm, thigh_left_cm, thigh_right_cm, biceps_left_cm, biceps_right_cm")
        .eq("user_id", supabaseUser.id)
        .eq("week_start", mondayStr)
        .maybeSingle();
      if (thisWeekCi) {
        const measures = [
          thisWeekCi.waist_cm,
          thisWeekCi.chest_cm,
          thisWeekCi.hip_cm,
          (thisWeekCi as any).thigh_left_cm,
          (thisWeekCi as any).thigh_right_cm,
          (thisWeekCi as any).biceps_left_cm,
          (thisWeekCi as any).biceps_right_cm,
        ];
        const allMissing = measures.every((v) => v == null);
        setCheckinMissingMeasures(allMissing);
      } else {
        setCheckinMissingMeasures(false);
      }

      const { count: tCount } = await supabase
        .from("training_set_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", supabaseUser.id)
        .gte("performed_at", `${todayStr}T00:00:00`)
        .lte("performed_at", `${todayStr}T23:59:59.999`);
      setTrainedToday((tCount ?? 0) > 0);

      setLoading(false);
    })();
  }, [supabaseUser, todayStr]);

  const name = profile?.display_name?.split(" ")[0] ?? supabaseUser?.email?.split("@")[0] ?? "";

  const checkinInfo = (() => {
    // Check-in dieser Woche bereits eingetragen, aber Maße fehlen → freundlicher Hinweis
    if (checkinMissingMeasures) {
      return {
        tone: "soon" as const,
        label: "Maße für Check-in ergänzen",
      };
    }
    if (!nextCheckin) return null;
    const today = new Date(todayStr);
    const target = new Date(nextCheckin);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) {
      return { tone: "overdue" as const, label: `Check-In überfällig seit ${Math.abs(diffDays)} Tag${Math.abs(diffDays) === 1 ? "" : "en"}` };
    }
    if (diffDays === 0) {
      return { tone: "today" as const, label: "Check-in heute fällig" };
    }
    if (diffDays <= 3) {
      return { tone: "soon" as const, label: `Nächster Check-in: in ${diffDays} Tag${diffDays === 1 ? "" : "en"}` };
    }
    return {
      tone: "future" as const,
      label: `Nächster Check-in: am ${target.toLocaleDateString("de-DE")}`,
    };
  })();

  return (
    <div className="space-y-6">
      
      <TrialWelcomeDialog />
      <TrialStatusBanner />
      <SportWeekdaysPrompt />
      {supabaseUser && <TrialChecklistGate userId={supabaseUser.id} />}

      {checkinInfo && (
        <Link
          to="/check-in"
          className={
            "flex items-center justify-between rounded-2xl border p-4 transition " +
            (checkinInfo.tone === "overdue"
              ? "border-destructive/60 bg-destructive/10 hover:border-destructive"
              : checkinInfo.tone === "today"
                ? "border-gold/60 bg-gradient-to-br from-gold/15 to-transparent hover:border-gold"
                : "border-border bg-card hover:border-gold/40")
          }
        >
          <div className="flex items-center gap-3">
            <div
              className={
                "grid h-10 w-10 place-items-center rounded-xl " +
                (checkinInfo.tone === "overdue"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-gradient-gold text-primary-foreground")
              }
            >
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <div
                className={
                  "text-xs uppercase tracking-wider " +
                  (checkinInfo.tone === "overdue" ? "text-destructive" : "text-gold")
                }
              >
                Check-in
              </div>
              <div className="font-display text-base font-bold">{checkinInfo.label}</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

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
        <DashboardQuickActions
          excludeKeys={[
            ...(trainedToday ? (["training"] as const) : []),
            ...(measuredToday ? (["measurement"] as const) : []),
          ]}
        />
      </div>

      {supabaseUser && <SmartAnalysisCTA />}
      {supabaseUser && <StrengthCheckStatus variant="card" />}
      {supabaseUser && <DailyMacroSummary userId={supabaseUser.id} />}


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

      {/* Level hero card */}
      {(() => {
        const points = userPts.total;
        const { level, next, progress } = getLevel(points);
        return (
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
                <Stat label="Heute" value={todayDbPoints} suffix={`/ ${MAX_DAILY_POINTS}`} />
                <Stat label="Training" value={userPts.perf} suffix="Pkt" accent={userPts.perf > 0} />
              </div>
            </div>
          </div>
        );
      })()}

      {supabaseUser && <PointsBreakdownCard userId={supabaseUser.id} />}

      {supabaseUser && <TrainingBonusCard userId={supabaseUser.id} />}


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

      {supabaseUser && <MacroTargetsCard userId={supabaseUser.id} />}

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
    {
      id: string;
      amount_eur: number | string;
      note: string | null;
      created_at: string;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_history")
        .select("id, amount_eur, note, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setPending((data as any) ?? []);
    })();
  }, [userId]);

  if (pending.length === 0) return null;
  const total = pending.reduce((s, p) => s + Number(p.amount_eur), 0);
  const paypalUrl = `https://www.paypal.me/ManuSchrader/${total}EUR`;

  // Frühestes pending bestimmt die Frist (3 Tage ab Anlage)
  const earliest = pending.reduce((a, b) =>
    new Date(a.created_at) < new Date(b.created_at) ? a : b,
  );
  const dueDate = new Date(earliest.created_at);
  dueDate.setDate(dueDate.getDate() + 3);
  const msLeft = dueDate.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86400000);
  const overdue = msLeft < 0;
  const dueLabel = dueDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const accent = overdue
    ? "border-destructive/60 from-destructive/20"
    : "border-gold/40 from-gold/15";
  const badge = overdue ? "text-destructive" : "text-gold";

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-r to-transparent p-5 ${accent}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            💳
          </div>
          <div>
            <div className={`text-xs uppercase tracking-wider ${badge}`}>
              {overdue ? "Zahlung überfällig" : "Zahlung ausstehend"}
            </div>
            <div className="font-display text-base font-bold">
              {overdue
                ? `Bitte zeitnah begleichen (Frist war ${dueLabel})`
                : `Bitte bis ${dueLabel} bezahlen`}
            </div>
            <div className="text-xs text-muted-foreground">
              {overdue
                ? `${Math.abs(daysLeft)} Tag(e) überfällig`
                : daysLeft <= 0
                ? "Heute fällig"
                : `Noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"} Zeit`}
              {pending.some((p) => p.note)
                ? ` · ${pending.map((p) => p.note).filter(Boolean).join(" · ")}`
                : ""}
            </div>
            <div className={`mt-1 font-display text-lg ${badge}`}>
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

const QUICK_ACTIONS = [
  { key: "training", to: "/training", label: "Training eintragen", Icon: Dumbbell },
  { key: "measurement", to: "/measurements", label: "Messung eintragen", Icon: Plus },
] as const;

type QuickActionKey = (typeof QUICK_ACTIONS)[number]["key"];

const SEEN_STORAGE_KEY = "bf:dashboard:quickActionsSeen";

function DashboardQuickActions({ excludeKeys = [] }: { excludeKeys?: readonly QuickActionKey[] }) {
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_STORAGE_KEY);
      if (raw) setSeen(JSON.parse(raw));
    } catch {}
  }, []);

  const markSeen = (key: string) => {
    setSeen((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      try {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const visible = QUICK_ACTIONS.filter((a) => !excludeKeys.includes(a.key));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map(({ key, to, label, Icon }) => (
        <Link
          key={key}
          to={to}
          onClick={() => markSeen(key)}
          className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90"
        >
          <Icon className="h-4 w-4" /> {label}
          {!seen[key] && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow">
              Neu
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function TrialChecklistGate({ userId }: { userId: string }) {
  const { isTrial } = useTrial();
  if (!isTrial) return null;
  return <TrialChecklist userId={userId} />;
}



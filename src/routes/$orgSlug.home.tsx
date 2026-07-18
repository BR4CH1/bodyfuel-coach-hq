import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Trophy, Activity, TrendingUp, Users, ShieldAlert, Sparkles, Dumbbell, Apple, Droplet, Moon, Calendar, Megaphone, Flame, ChevronRight, ChevronDown } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getOrgHomeData,
  updateOrgTaskStatus,
} from "@/lib/organizations/athlete.functions";
import { listRecentReadinessGateEvents, type ReadinessGateEvent } from "@/lib/readiness-gate-events.functions";

import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { OrganizationContextSwitcher, setActiveContext } from "@/components/organizations/OrganizationContextSwitcher";
import { Route as OrgLayoutRoute } from "./$orgSlug";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/bodyfuel/UserAvatar";
import { AthletePlayerCardThumb } from "@/components/player-cards/AthletePlayerCardThumb";
import { Fuely } from "@/components/bodyfuel/Fuely";
import { PlanStatusChip } from "@/components/organizations/PlanStatusChip";
import { LoadWeekBanner } from "@/components/bodyfuel/LoadWeekBanner";




export const Route = createFileRoute("/$orgSlug/home")({
  component: OrgHome,
});

const TASK_TYPE_LABEL: Record<string, string> = {
  daily_checkin: "DAILY CHECK-IN",
  recovery: "RECOVERY",
  challenge: "CHALLENGE",
  hydration: "HYDRATION",
  training_feedback: "TRAININGSFEEDBACK",
  custom: "AUFGABE",
  manual: "AUFGABE",
};

const TRAINING_SOURCE_LABEL: Record<string, string> = {
  coach: "COACH TRAINING",
  smart: "SMART TRAINING",
  athlete: "EIGENES TRAINING",
};


function greet() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

function OrgHome() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchHome = useServerFn(getOrgHomeData);
  const updateTask = useServerFn(updateOrgTaskStatus);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
    if (supabaseUser) setActiveContext(org.slug);
  }, [supabaseUser, loading, org.slug, navigate]);

  // Task Engine wird zentral aus dem Coach-Dashboard ausgelöst (Staff/Coach-Berechtigung erforderlich).



  const { data, isLoading, error } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { taskId: string; status: "open" | "done" }) => updateTask({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-home", org.slug] }),
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  if (isLoading || !data) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;
  }
  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <div className="text-sm text-destructive">Kein Zugriff auf diese Organisation.</div>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/dashboard">Mein BODYFUEL</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Coach-Guard: Wenn User Staff/Coach ohne Player-Rolle ist, gehört er nicht
  // ins Athleten-Home. Redirect ins Coach-Cockpit.
  const isPlayer = !!data.membership && (data.membership as any).role === "athlete";
  const isStaffOrCoach = !!(data.staff || data.is_super_admin);
  if (!isPlayer && isStaffOrCoach) {
    navigate({ to: "/coach/teams/$orgId", params: { orgId: (data.org as any).id }, replace: true });
    return null;
  }

  // Onboarding gate
  if (data.membership && !data.membership.onboarding_completed) {
    navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: org.slug }, replace: true });
    return null;
  }

  const bg = org.primary_color ?? "#000000";
  const primary = org.primary_color ?? "#e11d48";
  const first = data.profile?.display_name ?? "Athlet";
  const featuresList = data.features as { feature: string; enabled: boolean }[];
  const featureEnabled = (k: string) => featuresList.some((f) => f.feature === k && f.enabled);

  return (
    <OrgAthleteLayout slug={org.slug} features={featuresList} primaryColor={primary}>
      <DailyCheckinPopup
        orgSlug={org.slug}
        userId={supabaseUser?.id}
        hasTodayCheckin={!!(data as any).today_checkin}
        primary={primary}
      />
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, #000 100%)` }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-sm font-bold">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                {org.name}
              </div>
              <div className="text-xs opacity-75">{greet()},</div>
              <div className="font-display text-xl font-bold">{first}</div>
            </div>
            
          </div>
          <OrganizationContextSwitcher compact />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider">
            {data.team && (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{data.team.name}</span>
            )}
            {data.team_membership?.position && (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                {data.team_membership.position}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {org.slug === "bulls" && <AthletePlayerCardThumb userId={supabaseUser?.id} />}
            <Link
              to="/$orgSlug/profil"
              params={{ orgSlug: org.slug }}
              className="shrink-0"
              aria-label="Zum Profil"
            >
              <UserAvatar
                path={(data.profile as any)?.avatar_url ?? null}
                name={first}
                size={64}
                className="ring-2 ring-white/40"
              />
            </Link>
          </div>

        </div>

      </header>

      {featureEnabled("load_management") && (
        <LoadWeekBanner
          orgId={(data.org as any).id}
          teamId={(data.team_membership as any)?.team_id ?? null}
        />
      )}

      <main className="mx-auto max-w-md px-4 py-5 space-y-5">
        <ReadinessGateHint userId={supabaseUser?.id} orgSlug={org.slug} />

        <DayStatusBanner
          sessions={(data as any).today_sessions ?? []}
          tasks={data.today_tasks ?? []}
          primary={primary}
        />

        {/* HEUTE — persönlicher Assistent */}
        <section>
          <SectionTitle>Heute</SectionTitle>
          <TodayAssistant
            orgSlug={org.slug}
            primary={primary}
            hasCheckin={!!(data as any).today_checkin}
            sessions={(data as any).today_sessions ?? []}
            tasks={data.today_tasks ?? []}
            onToggleTask={(taskId, status) => toggle.mutate({ taskId, status })}
          />
        </section>

        {/* TAGESFORTSCHRITT */}
        <section>
          <ProgressRingCard
            hasCheckin={!!(data as any).today_checkin}
            sessions={(data as any).today_sessions ?? []}
            tasks={data.today_tasks ?? []}
            primary={primary}
          />
        </section>

        {/* TRAINING HEUTE */}
        <section>
          <SectionTitle>Training heute</SectionTitle>
          <TrainingTodayCard
            sessions={(data as any).today_sessions ?? []}
            orgSlug={org.slug}
            primary={primary}
          />
        </section>

        {/* NÄCHSTER TERMIN */}
        {data.next_tasks.length > 0 && (
          <section>
            <SectionTitle>Nächster Termin</SectionTitle>
            <NextAppointmentCard task={data.next_tasks[0] as any} primary={primary} />
          </section>
        )}

        {/* COMMUNITY */}
        {featureEnabled("challenges") && (
          <section>
            <SectionTitle>Community</SectionTitle>
            <CommunityCard
              orgSlug={org.slug}
              primary={primary}
              rank={data.challenge_progress?.rank ?? null}
              points={data.challenge_progress?.points ?? 0}
              challenge={data.active_challenge as any}
            />
          </section>
        )}

        {/* NEWS */}
        <section>
          <SectionTitle>News</SectionTitle>
          <NewsCard orgSlug={org.slug} primary={primary} />
        </section>

        {/* STATISTIKEN — jetzt einklappbar unten */}
        <StatsCollapsible
          readinessScore={(data as any).readiness_score}
          readinessDays7={(data as any).readiness_days_recorded_7}
          hasCheckin={!!(data as any).today_checkin}
          weeklyCompliance={data.weekly_compliance}
          rank={data.challenge_progress?.rank ?? null}
          primary={primary}
        />
      </main>

    </OrgAthleteLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</h2>;
}

/**
 * Zeigt beim ersten Login des Tages ein Popup, das an den Daily Check-in
 * erinnert. Wird pro User + Tag maximal einmal angezeigt (localStorage-Key).
 * Sobald der Check-in vorliegt (`hasTodayCheckin`), wird das Popup NICHT
 * mehr geöffnet — der Haken passiert dann auf natürlichem Weg.
 */
function DailyCheckinPopup({
  orgSlug,
  userId,
  hasTodayCheckin,
  primary,
}: {
  orgSlug: string;
  userId: string | undefined;
  hasTodayCheckin: boolean;
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!userId || hasTodayCheckin) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `bf:checkin-prompt:${userId}:${today}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    // kleine Verzögerung, damit Home fertig gerendert wirkt
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [userId, hasTodayCheckin]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Wie fühlst du dich heute?</DialogTitle>
          <DialogDescription>
            Dein Daily Check-in dauert unter einer Minute — er hält Training, Plan und Coach ehrlich auf deinem tatsächlichen Zustand.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Später
          </button>
          <Link
            to="/$orgSlug/checkin"
            params={{ orgSlug }}
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: primary }}
          >
            Jetzt Check-in starten →
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadinessGateHint({ userId, orgSlug }: { userId: string | undefined; orgSlug: string }) {
  const fetchEvents = useServerFn(listRecentReadinessGateEvents);
  const { data: events } = useQuery({
    queryKey: ["my-gate-events", userId ?? "anon"],
    enabled: !!userId,
    queryFn: () => fetchEvents({ data: { userId: userId as string, days: 7 } }),
  });
  const list = (events ?? []) as ReadinessGateEvent[];
  if (list.length === 0) return null;
  const hard = list.filter((e) => e.readiness_gate === "reduce").length;
  const soft = list.filter((e) => e.readiness_gate === "hold").length;
  // Spiegelt die Coach-Alert-Severity (siehe coach-alerts.functions.ts):
  //   ≥3 harte Bremsen in 7 Tagen  → rot (Coach sieht "Wiederholte harte Bremsen")
  //   2  harte Bremsen             → orange (Coach sieht "Mehrfache Bremse durch Readiness")
  //   sonst                        → neutral-orange
  const severity: "red" | "orange" | "soft" = hard >= 3 ? "red" : hard === 2 ? "orange" : "soft";
  const toneClass =
    severity === "red"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : "border-orange-400/40 bg-orange-400/10 text-orange-100";
  const headline =
    severity === "red"
      ? "Dein Körper braucht eine Pause"
      : severity === "orange"
        ? "Dein Plan hört auf dich"
        : "Dein Plan hört auf dich";
  const body =
    severity === "red"
      ? `Dein Plan hat in 7 Tagen ${hard}× hart abgebremst. Dein Coach sieht das ebenfalls und meldet sich bei Bedarf — bleib bei den Check-ins, damit wir sehen, wann es wieder rauf gehen kann.`
      : `In den letzten 7 Tagen hat dein Plan ${list.length}× Steigerungen bewusst pausiert${
          hard > 0 ? ` (${hard}× hart)` : ""
        }${soft > 0 ? ` (${soft}× weich)` : ""}. Bleib bei den täglichen Check-ins — sobald sich deine Werte erholen, geht es automatisch weiter.`;
  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
        <ShieldAlert className="h-3.5 w-3.5" /> {headline}
      </div>
      <p className="mt-1 text-sm leading-snug">{body}</p>
      <Link
        to="/$orgSlug/checkin"
        params={{ orgSlug }}
        search={{ focus: "readiness" }}
        className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-wider underline"
      >
        Zum Check-in →
      </Link>
    </section>
  );
}


function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: any; onToggle: () => void }) {
  const done = task.status === "done";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button type="button" onClick={onToggle} className="shrink-0">
        {done ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
        </div>
        <div className={`text-sm font-semibold ${done ? "line-through opacity-60" : ""}`}>{task.title}</div>
        {task.subtitle && <div className="text-xs text-muted-foreground">{task.subtitle}</div>}
      </div>
      {task.duration_min && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" />
          {task.duration_min} Min
        </div>
      )}
    </li>
  );
}

function SessionCard({
  session,
  primary,
  orgSlug,
}: {
  session: any;
  primary: string;
  orgSlug: string;
}) {
  const label = TRAINING_SOURCE_LABEL[session.training_source] ?? "TRAINING";
  const done = session.status === "completed";
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          style={{ background: primary }}
          aria-hidden
        >
          <Activity className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primary }}>
            {label}
          </div>
          <div className={`text-sm font-semibold truncate ${done ? "line-through opacity-60" : ""}`}>
            {session.name ?? "Training"}
          </div>
          {session.focus && (
            <div className="text-xs text-muted-foreground truncate">{session.focus}</div>
          )}
        </div>
        {session.duration_minutes && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" />
            {session.duration_minutes} Min
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <Link
          to="/$orgSlug/training"
          params={{ orgSlug }}
          className="text-[10px] font-bold uppercase tracking-wider underline"
          style={{ color: primary }}
        >
          Öffnen
        </Link>
      </div>

    </li>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  hint,
  primary,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  primary: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: primary }} />
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* =====================================================================
 * NEUE HOME-KOMPONENTEN — persönlicher Tagesassistent
 * ===================================================================*/

function classifyDay(sessions: any[], tasks: any[]): { status: string; summary: string } {
  const hasSession = sessions.length > 0;
  const isMatch = sessions.some((s) => /match|spiel|game/i.test(s.name ?? "") || /match|spiel|game/i.test(s.focus ?? ""));
  const isRecovery =
    tasks.some((t) => t.task_type === "recovery") ||
    sessions.some((s) => /regen|recovery|mobility/i.test(s.name ?? "") || /regen|recovery|mobility/i.test(s.focus ?? ""));

  if (isMatch) {
    return {
      status: "Heute steht ein Match an.",
      summary: "Fokus auf Warm-up, Flüssigkeit und mentale Vorbereitung.",
    };
  }
  if (hasSession) {
    const focus = sessions[0]?.focus ?? sessions[0]?.name ?? "Training";
    return {
      status: "Heute ist Trainingstag.",
      summary: `Fokus auf ${focus}, Mobility und ausreichend Proteinzufuhr.`,
    };
  }
  if (isRecovery) {
    return {
      status: "Heute ist Regenerationstag.",
      summary: "Fokus auf Schlaf, Flüssigkeit und leichte Mobility.",
    };
  }
  return {
    status: "Heute hast du keine festen Einheiten geplant.",
    summary: "Nutze den Tag für Mobility, Ernährung und deine Tagesziele.",
  };
}

function DayStatusBanner({
  sessions,
  tasks,
  primary,
}: {
  sessions: any[];
  tasks: any[];
  primary: string;
}) {
  const { status, summary } = classifyDay(sessions, tasks);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: primary }}>
        <Sparkles className="h-3.5 w-3.5" /> Dein Tag
      </div>
      <div className="mt-1 font-display text-lg font-bold leading-tight">{status}</div>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}

type AssistItem = {
  key: string;
  icon: any;
  label: string;
  hint?: string;
  done: boolean;
  onToggle?: () => void;
  href?: { to: any; params?: any };
};

function TodayAssistant({
  orgSlug,
  primary,
  hasCheckin,
  sessions,
  tasks,
  onToggleTask,
}: {
  orgSlug: string;
  primary: string;
  hasCheckin: boolean;
  sessions: any[];
  tasks: any[];
  onToggleTask: (taskId: string, status: "open" | "done") => void;
}) {
  const trainingDone = sessions.length > 0 && sessions.every((s) => s.status === "completed");
  const trainingItem: AssistItem | null =
    sessions.length > 0
      ? {
          key: "training",
          icon: Dumbbell,
          label: sessions[0].name ?? "Training absolvieren",
          hint: sessions[0].focus ?? undefined,
          done: trainingDone,
          href: { to: "/$orgSlug/training", params: { orgSlug } },
        }
      : null;

  const items: AssistItem[] = [
    {
      key: "checkin",
      icon: Activity,
      label: "Daily Check-in ausfüllen",
      hint: hasCheckin ? "Erledigt" : "Wie fühlst du dich heute?",
      done: hasCheckin,
      href: { to: "/$orgSlug/checkin", params: { orgSlug } },
    },
    ...(trainingItem ? [trainingItem] : []),
    ...tasks.map((t: any) => ({
      key: `task-${t.id}`,
      icon: iconForTask(t.task_type),
      label: t.title,
      hint: t.subtitle ?? undefined,
      done: t.status === "done",
      onToggle: () => onToggleTask(t.id, t.status === "done" ? "open" : "done"),
    })),
  ];

  if (items.length === 0) {
    return <EmptyCard>Heute sind keine Aufgaben geplant.</EmptyCard>;
  }

  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <AssistRow key={it.key} item={it} primary={primary} />
      ))}
    </ul>
  );
}

function iconForTask(type: string): any {
  switch (type) {
    case "hydration":
      return Droplet;
    case "recovery":
      return Moon;
    case "daily_checkin":
      return Activity;
    case "challenge":
      return Trophy;
    case "training_feedback":
      return Dumbbell;
    default:
      return CheckCircle2;
  }
}

function AssistRow({ item, primary }: { item: AssistItem; primary: string }) {
  const Icon = item.icon;
  const inner = (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        item.done ? "border-green-500/40 bg-green-500/10" : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          if (!item.onToggle) return;
          e.preventDefault();
          e.stopPropagation();
          item.onToggle();
        }}
        className="shrink-0"
        aria-label={item.done ? "Als offen markieren" : "Als erledigt markieren"}
      >
        {item.done ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
        style={{ background: item.done ? "#22c55e" : primary }}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${item.done ? "line-through opacity-60" : ""}`}>
          {item.label}
        </div>
        {item.hint && <div className="truncate text-xs text-muted-foreground">{item.hint}</div>}
      </div>
      {item.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );

  if (item.href) {
    return (
      <li>
        <Link to={item.href.to} params={item.href.params}>
          {inner}
        </Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}

function ProgressRingCard({
  hasCheckin,
  sessions,
  tasks,
  primary,
}: {
  hasCheckin: boolean;
  sessions: any[];
  tasks: any[];
  primary: string;
}) {
  const items: { label: string; done: boolean }[] = [
    { label: "Check-in", done: hasCheckin },
  ];
  if (sessions.length > 0) {
    items.push({ label: "Training", done: sessions.every((s) => s.status === "completed") });
  }
  for (const t of tasks) {
    items.push({ label: t.title, done: t.status === "done" });
  }
  const total = items.length || 1;
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / total) * 100);
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={primary}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-display text-2xl font-bold leading-none">{pct}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">erledigt</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {items.slice(0, 5).map((i, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm">
              {i.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={`truncate ${i.done ? "text-muted-foreground line-through" : ""}`}>{i.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TrainingTodayCard({
  sessions,
  orgSlug,
  primary,
}: {
  sessions: any[];
  orgSlug: string;
  primary: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5 text-center">
        <Dumbbell className="mx-auto h-6 w-6 text-muted-foreground" />
        <div className="mt-2 text-sm text-muted-foreground">Heute ist kein Training geplant.</div>
      </div>
    );
  }
  const s = sessions[0];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: primary }}
        >
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {TRAINING_SOURCE_LABEL[s.training_source] ?? "Training"}
          </div>
          <div className="font-display text-lg font-bold leading-tight">{s.name ?? "Training"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {s.duration_minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {s.duration_minutes} Min
              </span>
            )}
            {s.focus && <span>{s.focus}</span>}
          </div>
        </div>
      </div>
      <Link
        to="/$orgSlug/training"
        params={{ orgSlug }}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
        style={{ background: primary }}
      >
        {s.status === "completed" ? "Training öffnen" : "Training starten"}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function NextAppointmentCard({ task, primary }: { task: any; primary: string }) {
  const d = new Date(task.scheduled_for);
  const weekday = d.toLocaleDateString("de-DE", { weekday: "long" });
  const dateStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const time = task.scheduled_time ?? null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{ background: primary }}
      >
        <Calendar className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {weekday} · {dateStr}
          {time ? ` · ${time}` : ""}
        </div>
        <div className="truncate font-display text-base font-bold">{task.title}</div>
        {task.subtitle && <div className="truncate text-xs text-muted-foreground">{task.subtitle}</div>}
      </div>
    </div>
  );
}

function CommunityCard({
  orgSlug,
  primary,
  rank,
  points,
  challenge,
}: {
  orgSlug: string;
  primary: string;
  rank: number | null;
  points: number;
  challenge: any;
}) {
  return (
    <Link
      to="/$orgSlug/community"
      params={{ orgSlug }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{ background: primary }}
      >
        <Users className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Trophy className="h-3.5 w-3.5" style={{ color: primary }} />
            {rank ? `Platz ${rank}` : "Ranking"}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Flame className="h-3.5 w-3.5" /> {points} Pkt
          </span>
        </div>
        {challenge?.name && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            Challenge: {challenge.name}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function NewsCard({ orgSlug, primary }: { orgSlug: string; primary: string }) {
  return (
    <Link
      to="/$orgSlug/community"
      params={{ orgSlug }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{ background: primary }}
      >
        <Megaphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Neuigkeiten aus dem Club</div>
        <div className="truncate text-xs text-muted-foreground">
          Ankündigungen, Kurse & Events deiner Organisation
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function StatsCollapsible({
  readinessScore,
  readinessDays7,
  hasCheckin,
  weeklyCompliance,
  rank,
  primary,
}: {
  readinessScore: number | null;
  readinessDays7: number | null;
  hasCheckin: boolean;
  weeklyCompliance: number | null;
  rank: number | null;
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left"
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Statistiken
          </div>
          <div className="text-sm font-semibold">Readiness, Performance & Compliance</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatusCard
            icon={Activity}
            label="Readiness"
            value={readinessScore != null ? `${readinessScore}` : "—"}
            hint={
              readinessScore != null
                ? "heute"
                : hasCheckin
                  ? `Lernphase · ${readinessDays7 ?? 0}/7`
                  : "Check-in offen"
            }
            primary={primary}
          />
          <StatusCard icon={TrendingUp} label="Performance" value="—" hint="Profile in Kürze" primary={primary} />
          <StatusCard
            icon={CheckCircle2}
            label="Weekly Compliance"
            value={weeklyCompliance != null ? `${weeklyCompliance}%` : "—"}
            primary={primary}
          />
          <StatusCard
            icon={Trophy}
            label="Team Rank"
            value={rank ? `#${rank}` : "—"}
            primary={primary}
          />
        </div>
      )}
    </section>
  );
}


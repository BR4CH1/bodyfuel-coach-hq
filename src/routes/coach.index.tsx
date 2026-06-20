import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ChevronRight,
  Inbox,
  Scale,
  Users,
  CheckCircle2,
  Clock,
  Utensils,
  Dumbbell,
  Trophy,
  CalendarClock,
  Zap,
  Moon,
} from "lucide-react";


import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { CoachTrialOverview } from "@/components/bodyfuel/CoachTrialOverview";
import { PendingDraftsCard } from "@/components/bodyfuel/PendingDraftsCard";
import { CoachDashboardSummary } from "@/components/bodyfuel/CoachDashboardSummary";
import { CoachRadarCard } from "@/components/bodyfuel/CoachRadarCard";
import { CoachTaskInboxCard } from "@/components/bodyfuel/CoachTaskInboxCard";
import { getCoachRadar } from "@/lib/coach-radar.functions";
import { supabase } from "@/integrations/supabase/client";
import { getRanking, type RankingPeriod } from "@/lib/coaching.functions";
import {
  listCoachTaskStates,
  setCoachTaskState,
  extendClientPlan,
  type CoachTaskState,
} from "@/lib/coach-tasks.functions";
import { generateCheckinDraft } from "@/lib/checkin-ai.functions";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Coach Dashboard — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CoachDashboard />
    </AppLayout>
  ),
});

type Client = {
  id: string;
  display_name: string | null;
  last_checkin: string | null;
  last_weight: number | null;
  last_weight_at: string | null;
  last_nutrition_at: string | null;
  last_nutrition_name: string | null;
  last_training_at: string | null;
  nutrition_plan_end: string | null;
  training_plan_end: string | null;
  kcal_dev: number | null;
  kcal_dev_dir: "over" | "under" | null;
  plateau_days: number | null;
};



type Lead = {
  id: string;
  name: string;
  email: string;
  goal: string | null;
  created_at: string;
};

function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function CoachDashboard() {
  const qc = useQueryClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const listStatesFn = useServerFn(listCoachTaskStates);
  const setStateFn = useServerFn(setCoachTaskState);
  const extendPlanFn = useServerFn(extendClientPlan);
  const genDraftFn = useServerFn(generateCheckinDraft);

  const taskStatesQuery = useQuery({
    queryKey: ["coach-task-states"],
    queryFn: () => listStatesFn(),
  });

  const taskStateMap = new Map<string, CoachTaskState>();
  (taskStatesQuery.data?.items ?? []).forEach((s) => taskStateMap.set(s.task_key, s));

  const mutateState = useMutation({
    mutationFn: (input: {
      task_key: string;
      action: "complete" | "reopen" | "snooze";
      snooze_hours?: number;
    }) => setStateFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-task-states"] }),
  });

  const extendPlanMut = useMutation({
    mutationFn: (input: { client_id: string; kind: "nutrition" | "training"; weeks: number; task_key: string }) =>
      extendPlanFn({ data: { client_id: input.client_id, kind: input.kind, weeks: input.weeks } }).then((res) => ({
        ...res,
        task_key: input.task_key,
        kind: input.kind,
      })),
    onSuccess: (res) => {
      toast.success(
        `${res.kind === "nutrition" ? "Ernährungsplan" : "Trainingsplan"} bis ${new Date(res.new_end).toLocaleDateString("de-DE")} verlängert`,
      );
      setStateFn({ data: { task_key: res.task_key, action: "complete" } }).then(() =>
        qc.invalidateQueries({ queryKey: ["coach-task-states"] }),
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Verlängerung fehlgeschlagen"),
  });

  const genDraftMut = useMutation({
    mutationFn: (input: { client_id: string; task_key: string }) =>
      genDraftFn({ data: { user_id: input.client_id } }).then((res) => ({ ...res, task_key: input.task_key })),
    onSuccess: (res) => {
      toast.success("Entwurf erstellt — im Kundenprofil prüfen");
      qc.invalidateQueries({ queryKey: ["pending-checkin-drafts"] });
      setStateFn({ data: { task_key: res.task_key, action: "complete" } }).then(() =>
        qc.invalidateQueries({ queryKey: ["coach-task-states"] }),
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Entwurf fehlgeschlagen"),
  });

  const [bulkExtendProgress, setBulkExtendProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkExtendMut = useMutation({
    mutationFn: async (items: Array<{ client_id: string; kind: "nutrition" | "training"; task_key: string }>) => {
      setBulkExtendProgress({ done: 0, total: items.length });
      let ok = 0;
      const errors: string[] = [];
      for (let i = 0; i < items.length; i++) {
        try {
          await extendPlanFn({ data: { client_id: items[i].client_id, kind: items[i].kind, weeks: 4 } });
          await setStateFn({ data: { task_key: items[i].task_key, action: "complete" } });
          ok++;
        } catch (e: any) {
          errors.push(e?.message ?? "Fehler");
        }
        setBulkExtendProgress({ done: i + 1, total: items.length });
      }
      return { ok, errors };
    },
    onSuccess: (res) => {
      if (res.ok > 0) toast.success(`${res.ok} Pläne um 4 Wochen verlängert`);
      if (res.errors.length > 0) toast.error(`${res.errors.length} fehlgeschlagen: ${res.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["coach-task-states"] });
    },
    onSettled: () => setTimeout(() => setBulkExtendProgress(null), 1500),
  });

  const [bulkDraftProgress, setBulkDraftProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkDraftMut = useMutation({
    mutationFn: async (items: Array<{ client_id: string; task_key: string }>) => {
      setBulkDraftProgress({ done: 0, total: items.length });
      let ok = 0;
      const errors: string[] = [];
      for (let i = 0; i < items.length; i++) {
        try {
          await genDraftFn({ data: { user_id: items[i].client_id } });
          await setStateFn({ data: { task_key: items[i].task_key, action: "complete" } });
          ok++;
        } catch (e: any) {
          errors.push(e?.message ?? "Fehler");
        }
        setBulkDraftProgress({ done: i + 1, total: items.length });
      }
      return { ok, errors };
    },
    onSuccess: (res) => {
      if (res.ok > 0) toast.success(`${res.ok} Entwürfe erstellt`);
      if (res.errors.length > 0) toast.error(`${res.errors.length} fehlgeschlagen: ${res.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["pending-checkin-drafts"] });
      qc.invalidateQueries({ queryKey: ["coach-task-states"] });
    },
    onSettled: () => setTimeout(() => setBulkDraftProgress(null), 1500),
  });

  const weekStart = mondayOf(new Date());




  useEffect(() => {
    (async () => {
      setLoading(true);

      // Find all client user_ids
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      const ids = (rolesData ?? []).map((r) => r.user_id);

      let clientRows: Client[] = [];
      if (ids.length > 0) {
        const [profiles, checkins, measurements, foods, sets, plans] = await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", ids),
          supabase
            .from("weekly_checkins")
            .select("user_id, week_start, submitted_at")
            .in("user_id", ids)
            .order("week_start", { ascending: false }),
          supabase
            .from("body_measurements")
            .select("user_id, weight_kg, measured_at")
            .in("user_id", ids)
            .order("measured_at", { ascending: false }),
          supabase
            .from("food_entries")
            .select("user_id, name, created_at")
            .in("user_id", ids)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("training_set_logs")
            .select("client_id, performed_at")
            .in("client_id", ids)
            .order("performed_at", { ascending: false })
            .limit(200),
          supabase
            .from("nutrition_plans")
            .select("id, client_id, plan_type, scheduled_end_date, status")
            .in("client_id", ids)
            .eq("status", "active"),
        ]);

        // Compute kcal deviation per client from active nutrition plans
        const activeNutritionPlans = (plans.data ?? []).filter(
          (p: any) => p.plan_type === "nutrition",
        );
        const nutritionPlanIds = activeNutritionPlans.map((p: any) => p.id);
        const planToClient = new Map<string, string>();
        activeNutritionPlans.forEach((p: any) => planToClient.set(p.id, p.client_id));

        const [targetsRes, daysRes] = await Promise.all([
          supabase
            .from("nutrition_targets")
            .select("user_id, kcal, kcal_rest")
            .in("user_id", ids),
          nutritionPlanIds.length
            ? supabase
                .from("nutrition_plan_days")
                .select("id, plan_id, name")
                .in("plan_id", nutritionPlanIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const dayList = (daysRes.data ?? []) as Array<{ id: string; plan_id: string; name: string }>;
        const dayIds = dayList.map((d) => d.id);
        const mealsRes = dayIds.length
          ? await supabase
              .from("nutrition_plan_meals")
              .select("day_id, kcal")
              .in("day_id", dayIds)
          : { data: [] as any[] };
        const sumByDay = new Map<string, number>();
        ((mealsRes.data ?? []) as any[]).forEach((m: any) => {
          if (m.kcal == null) return;
          sumByDay.set(m.day_id, (sumByDay.get(m.day_id) ?? 0) + Number(m.kcal));
        });
        const targetByUser = new Map<string, { t: number | null; r: number | null }>();
        ((targetsRes.data ?? []) as any[]).forEach((t: any) => {
          targetByUser.set(t.user_id, {
            t: t.kcal ?? null,
            r: t.kcal_rest ?? t.kcal ?? null,
          });
        });
        const kcalDev = new Map<string, { dev: number; dir: "over" | "under" }>();
        dayList.forEach((d) => {
          const clientId = planToClient.get(d.plan_id);
          if (!clientId) return;
          const tgt = targetByUser.get(clientId);
          if (!tgt) return;
          const sum = sumByDay.get(d.id);
          if (!sum) return;
          const isRest = /(rest|ruhe|pause)/i.test(d.name || "");
          const target = isRest ? tgt.r : tgt.t;
          if (!target) return;
          const diff = sum - target;
          const abs = Math.abs(diff);
          const prev = kcalDev.get(clientId);
          if (!prev || abs > prev.dev) {
            kcalDev.set(clientId, { dev: abs, dir: diff >= 0 ? "over" : "under" });
          }
        });

        const lastCheckin = new Map<string, string>();
        (checkins.data ?? []).forEach((c) => {
          if (!lastCheckin.has(c.user_id)) lastCheckin.set(c.user_id, c.week_start);
        });
        const lastWeight = new Map<string, { w: number | null; at: string }>();
        const weightsByUser = new Map<string, Array<{ w: number; at: string }>>();
        (measurements.data ?? []).forEach((m) => {
          if (!lastWeight.has(m.user_id))
            lastWeight.set(m.user_id, { w: m.weight_kg, at: m.measured_at });
          if (m.weight_kg != null) {
            const arr = weightsByUser.get(m.user_id) ?? [];
            arr.push({ w: Number(m.weight_kg), at: m.measured_at });
            weightsByUser.set(m.user_id, arr);
          }
        });
        const nowMs = Date.now();
        const plateauByUser = new Map<string, number>();
        weightsByUser.forEach((series, uid) => {
          if (series.length < 2) return;
          const latest = series[0];
          const olderRef = series.find((m) => {
            const age = (nowMs - new Date(m.at).getTime()) / 86400000;
            return age >= 10 && age <= 21;
          });
          if (olderRef && Math.abs(latest.w - olderRef.w) <= 0.3) {
            plateauByUser.set(
              uid,
              Math.round((nowMs - new Date(olderRef.at).getTime()) / 86400000),
            );
          }
        });
        const lastFood = new Map<string, { at: string; name: string }>();
        (foods.data ?? []).forEach((f) => {
          if (!lastFood.has(f.user_id))
            lastFood.set(f.user_id, { at: f.created_at, name: f.name });
        });
        const lastTraining = new Map<string, string>();
        (sets.data ?? []).forEach((s) => {
          if (!lastTraining.has(s.client_id)) lastTraining.set(s.client_id, s.performed_at);
        });
        const nutritionEnd = new Map<string, string>();
        const trainingEnd = new Map<string, string>();
        (plans.data ?? []).forEach((p: any) => {
          if (!p.scheduled_end_date) return;
          const map = p.plan_type === "training" ? trainingEnd : nutritionEnd;
          const existing = map.get(p.client_id);
          if (!existing || p.scheduled_end_date > existing) {
            map.set(p.client_id, p.scheduled_end_date);
          }
        });

        clientRows = (profiles.data ?? []).map((p) => ({
          id: p.id,
          display_name: p.display_name,
          last_checkin: lastCheckin.get(p.id) ?? null,
          last_weight: lastWeight.get(p.id)?.w ?? null,
          last_weight_at: lastWeight.get(p.id)?.at ?? null,
          last_nutrition_at: lastFood.get(p.id)?.at ?? null,
          last_nutrition_name: lastFood.get(p.id)?.name ?? null,
          last_training_at: lastTraining.get(p.id) ?? null,
          nutrition_plan_end: nutritionEnd.get(p.id) ?? null,
          training_plan_end: trainingEnd.get(p.id) ?? null,
          kcal_dev: kcalDev.get(p.id)?.dev ?? null,
          kcal_dev_dir: kcalDev.get(p.id)?.dir ?? null,
          plateau_days: plateauByUser.get(p.id) ?? null,
        }));
      }


      setClients(clientRows);

      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, goal, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10);
      setLeads((leadsData as Lead[]) ?? []);

      setLoading(false);
    })();
  }, []);

  const openWeek = clients.filter((c) => c.last_checkin !== weekStart);
  const inactive = clients
    .map((c) => ({ ...c, days: daysAgo(c.last_checkin) }))
    .filter((c) => c.days === null || c.days >= 14)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
  const recentMeasurements = [...clients]
    .filter((c) => c.last_weight_at)
    .sort(
      (a, b) =>
        new Date(b.last_weight_at!).getTime() - new Date(a.last_weight_at!).getTime(),
    )
    .slice(0, 6);
  const recentNutrition = [...clients]
    .filter((c) => c.last_nutrition_at)
    .sort(
      (a, b) =>
        new Date(b.last_nutrition_at!).getTime() - new Date(a.last_nutrition_at!).getTime(),
    )
    .slice(0, 6);
  const recentTraining = [...clients]
    .filter((c) => c.last_training_at)
    .sort(
      (a, b) =>
        new Date(b.last_training_at!).getTime() - new Date(a.last_training_at!).getTime(),
    )
    .slice(0, 6);

  const todayIso = new Date().toISOString().slice(0, 10);
  const WARN_DAYS = 5;
  const expiringPlans = clients
    .flatMap((c) => {
      const out: Array<{ id: string; name: string; kind: "nutrition" | "training"; end: string; days: number }> = [];
      if (c.nutrition_plan_end) {
        out.push({
          id: c.id,
          name: c.display_name ?? "Ohne Namen",
          kind: "nutrition",
          end: c.nutrition_plan_end,
          days: Math.ceil((new Date(c.nutrition_plan_end).getTime() - new Date(todayIso).getTime()) / 86400000),
        });
      }
      if (c.training_plan_end) {
        out.push({
          id: c.id,
          name: c.display_name ?? "Ohne Namen",
          kind: "training",
          end: c.training_plan_end,
          days: Math.ceil((new Date(c.training_plan_end).getTime() - new Date(todayIso).getTime()) / 86400000),
        });
      }
      return out;
    })
    .filter((p) => p.days <= WARN_DAYS)
    .sort((a, b) => a.days - b.days);

  const planOverview = [...clients]
    .filter((c) => c.nutrition_plan_end || c.training_plan_end)
    .sort((a, b) => {
      const ae = Math.min(
        a.nutrition_plan_end ? new Date(a.nutrition_plan_end).getTime() : Infinity,
        a.training_plan_end ? new Date(a.training_plan_end).getTime() : Infinity,
      );
      const be = Math.min(
        b.nutrition_plan_end ? new Date(b.nutrition_plan_end).getTime() : Infinity,
        b.training_plan_end ? new Date(b.training_plan_end).getTime() : Infinity,
      );
      return ae - be;
    });

  // ---- Coach Score per client (🟢 on track / 🟡 watch / 🔴 action needed) ----
  const scoreById = new Map<string, { score: number; level: "green" | "yellow" | "red"; reasons: string[] }>();
  clients.forEach((c) => {
    let score = 100;
    const reasons: string[] = [];

    const checkinDays = daysAgo(c.last_checkin);
    if (c.last_checkin !== weekStart) {
      if (checkinDays === null) {
        score -= 30; reasons.push("Noch nie eingecheckt");
      } else if (checkinDays >= 14) {
        score -= 35; reasons.push(`Check-in ${checkinDays}T alt`);
      } else {
        score -= 15; reasons.push("Wochen-Check-in offen");
      }
    }

    const lastActivity = [c.last_training_at, c.last_nutrition_at, c.last_weight_at]
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    if (lastActivity.length === 0) {
      score -= 20; reasons.push("Keine Aktivität");
    } else {
      const newest = Math.max(...lastActivity);
      const days = Math.floor((Date.now() - newest) / 86400000);
      if (days >= 14) { score -= 25; reasons.push(`Inaktiv ${days}T`); }
      else if (days >= 7) { score -= 10; reasons.push(`Inaktiv ${days}T`); }
    }

    if (c.kcal_dev != null) {
      if (c.kcal_dev > 500) { score -= 15; reasons.push(`kcal-Abweichung ${c.kcal_dev}`); }
      else if (c.kcal_dev > 200) { score -= 5; }
    }

    if (c.plateau_days != null) {
      score -= 10; reasons.push(`Plateau ${c.plateau_days}T`);
    }

    const planDays = [c.nutrition_plan_end, c.training_plan_end]
      .filter(Boolean)
      .map((d) => Math.ceil((new Date(d!).getTime() - new Date(todayIso).getTime()) / 86400000));
    if (planDays.length) {
      const minDays = Math.min(...planDays);
      if (minDays < 0) { score -= 20; reasons.push("Plan abgelaufen"); }
      else if (minDays <= 5) { score -= 10; reasons.push(`Plan läuft in ${minDays}T aus`); }
    }

    score = Math.max(0, Math.min(100, score));
    const level: "green" | "yellow" | "red" = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
    scoreById.set(c.id, { score, level, reasons });
  });

  const scoreCounts = {
    green: clients.filter((c) => scoreById.get(c.id)?.level === "green").length,
    yellow: clients.filter((c) => scoreById.get(c.id)?.level === "yellow").length,
    red: clients.filter((c) => scoreById.get(c.id)?.level === "red").length,
  };
  const redClients = clients
    .filter((c) => scoreById.get(c.id)?.level === "red")
    .map((c) => ({ ...c, _score: scoreById.get(c.id)! }))
    .sort((a, b) => a._score.score - b._score.score);





  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Woche ab {new Date(weekStart).toLocaleDateString("de-DE")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill icon={<Users className="h-4 w-4" />} value={clients.length} label="Kunden" />
          <StatPill icon={<Inbox className="h-4 w-4" />} value={leads.length} label="Neue Leads" />
          <StatPill
            icon={<Clock className="h-4 w-4" />}
            value={openWeek.length}
            label="Check-in offen"
            warn={openWeek.length > 0}
          />
          <StatPill
            icon={<CalendarClock className="h-4 w-4" />}
            value={expiringPlans.length}
            label="Pläne laufen aus"
            warn={expiringPlans.length > 0}
          />

          <Link
            to="/coach/package-requests"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-gold/40"
          >
            <span className="text-gold">📦</span>
            <span className="font-display text-sm font-bold">Paketanfragen</span>
          </Link>
        </div>

      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Lade…
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* ===== 1. HANDLUNGSBEDARF ===== */}
          <ActionNeededHero
            openCheckins={openWeek.length}
            expiringPlans={expiringPlans.length}
            inactive={inactive.length}
            newLeads={leads.length}
          />

          <CoachDashboardSummary data={radarQuery.data} />
          <CoachRadarCard data={radarQuery.data} />
          <CoachTaskInboxCard data={radarQuery.data} />

          <TaskInboxCard
            openCheckins={openWeek}
            expiringPlans={expiringPlans}
            redClients={redClients}
            states={taskStateMap}
            onAction={(task_key, action, snooze_hours) =>
              mutateState.mutate({ task_key, action, snooze_hours })
            }
            mutating={mutateState.isPending}
            onExtendPlan={(client_id, kind, task_key) =>
              extendPlanMut.mutate({ client_id, kind, weeks: 4, task_key })
            }
            extendingKey={extendPlanMut.isPending ? extendPlanMut.variables?.task_key : null}
            onGenerateDraft={(client_id, task_key) =>
              genDraftMut.mutate({ client_id, task_key })
            }
            generatingKey={genDraftMut.isPending ? genDraftMut.variables?.task_key : null}
            onBulkExtend={(items) => bulkExtendMut.mutate(items)}
            bulkExtendProgress={bulkExtendProgress}
            bulkExtending={bulkExtendMut.isPending}
            onBulkDraft={(items) => bulkDraftMut.mutate(items)}
            bulkDraftProgress={bulkDraftProgress}
            bulkDrafting={bulkDraftMut.isPending}
          />




          <PendingDraftsCard
            redClients={redClients.map((c) => ({ id: c.id, display_name: c.display_name }))}
          />


          <SectionHeader title="Handlungsbedarf" subtitle="Was heute deine Aufmerksamkeit braucht" />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Diese Woche offen */}
            <Panel
              icon={<Clock className="h-5 w-5" />}
              title="Offene Check-ins (diese Woche)"
              empty={openWeek.length === 0}
              emptyText="Alle Kunden haben ihren Wochen-Check-in abgegeben 🎉"
              footer={
                <Link to="/coach/customers" className="text-xs font-semibold text-gold hover:underline">
                  Alle Kunden ansehen →
                </Link>
              }
            >
              {openWeek.slice(0, 8).map((c) => (
                <CustomerRow
                  key={c.id}
                  id={c.id}
                  name={c.display_name ?? "Ohne Namen"}
                  kcalDev={c.kcal_dev}
                  kcalDir={c.kcal_dev_dir}
                  plateauDays={c.plateau_days}
                  scoreLevel={scoreById.get(c.id)?.level ?? null}
                  scoreValue={scoreById.get(c.id)?.score ?? null}
                  meta={
                    c.last_checkin
                      ? `Letzter Check-in ${new Date(c.last_checkin).toLocaleDateString("de-DE")}`
                      : "Noch nie eingecheckt"
                  }
                />
              ))}
              {openWeek.length > 8 && (
                <div className="px-1 pt-1 text-xs text-muted-foreground">
                  +{openWeek.length - 8} weitere
                </div>
              )}
            </Panel>

            {/* Plan-Warnungen */}
            <Panel
              icon={<CalendarClock className="h-5 w-5" />}
              title="Auslaufende Pläne (≤ 5 Tage)"
              empty={expiringPlans.length === 0}
              emptyText="Alle Pläne haben noch Laufzeit."
            >
              {expiringPlans.slice(0, 10).map((p, i) => (
                <CustomerRow
                  key={`${p.id}-${p.kind}-${i}`}
                  id={p.id}
                  name={p.name}
                  warn
                  meta={`${p.kind === "training" ? "Trainingsplan" : "Ernährungsplan"} ${
                    p.days < 0
                      ? `seit ${Math.abs(p.days)} Tagen abgelaufen`
                      : p.days === 0
                        ? "läuft heute aus"
                        : `läuft in ${p.days} Tagen aus (${new Date(p.end).toLocaleDateString("de-DE")})`
                  }`}
                />
              ))}
            </Panel>

            {/* Risiko / Inaktiv */}
            <Panel
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Risikowarnungen (Inaktiv 14+ Tage)"
              empty={inactive.length === 0}
              emptyText="Niemand inaktiv. Top!"
            >
              {inactive.slice(0, 8).map((c) => (
                <CustomerRow
                  key={c.id}
                  id={c.id}
                  name={c.display_name ?? "Ohne Namen"}
                  warn
                  kcalDev={c.kcal_dev}
                  kcalDir={c.kcal_dev_dir}
                  plateauDays={c.plateau_days}
                  scoreLevel={scoreById.get(c.id)?.level ?? null}
                  scoreValue={scoreById.get(c.id)?.score ?? null}
                  meta={
                    c.days === null
                      ? "Noch nie eingecheckt"
                      : `Vor ${c.days} Tagen zuletzt aktiv`
                  }
                />
              ))}
            </Panel>

            {/* Neue Leads */}
            <Panel
              icon={<Inbox className="h-5 w-5" />}
              title="Neue Anfragen"
              empty={leads.length === 0}
              emptyText="Keine neuen Anfragen"
              footer={
                <Link to="/coach/leads" className="text-xs font-semibold text-gold hover:underline">
                  Alle Anfragen →
                </Link>
              }
            >
              {leads.slice(0, 6).map((l) => (
                <Link
                  key={l.id}
                  to="/coach/leads"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 hover:border-gold/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                    {l.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.goal ?? l.email}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("de-DE")}
                  </div>
                </Link>
              ))}
            </Panel>
          </div>

          {/* ===== 2. KUNDENÜBERSICHT ===== */}
          <SectionHeader title="Kundenübersicht" subtitle="Pläne, Messungen, Aktivität" />
          <CoachScoreCard
            counts={scoreCounts}
            total={clients.length}
            redClients={redClients}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              icon={<CalendarClock className="h-5 w-5" />}
              title="Plan-Übersicht"
              empty={planOverview.length === 0}
              emptyText="Keine aktiven Pläne hinterlegt."
            >
              {planOverview.slice(0, 12).map((c) => (
                <Link
                  key={c.id}
                  to="/coach/customers/$userId"
                  params={{ userId: c.id }}
                  className="block rounded-xl border border-border bg-background/40 p-3 transition hover:border-gold/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {c.display_name ?? "Ohne Namen"}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                    <PlanValidity label="Training" end={c.training_plan_end} />
                    <PlanValidity label="Ernährung" end={c.nutrition_plan_end} />
                  </div>
                </Link>
              ))}
            </Panel>

            <Panel
              icon={<Scale className="h-5 w-5" />}
              title="Letzte Messungen"
              empty={recentMeasurements.length === 0}
              emptyText="Noch keine Messungen erfasst"
            >
              {recentMeasurements.map((c) => (
                <CustomerRow
                  key={c.id}
                  id={c.id}
                  name={c.display_name ?? "Ohne Namen"}
                  meta={
                    c.last_weight_at
                      ? `${c.last_weight ?? "—"} kg · ${new Date(
                          c.last_weight_at,
                        ).toLocaleDateString("de-DE")}`
                      : "—"
                  }
                  tone="info"
                />
              ))}
            </Panel>

            <Panel
              icon={<Utensils className="h-5 w-5" />}
              title="Letzte Eintragung Ernährung"
              empty={recentNutrition.length === 0}
              emptyText="Noch keine Ernährungs-Einträge"
            >
              {recentNutrition.map((c) => (
                <CustomerRow
                  key={c.id}
                  id={c.id}
                  name={c.display_name ?? "Ohne Namen"}
                  meta={`${c.last_nutrition_name ?? "Eintrag"} · ${new Date(
                    c.last_nutrition_at!,
                  ).toLocaleDateString("de-DE")}`}
                  tone="info"
                />
              ))}
            </Panel>

            <Panel
              icon={<Dumbbell className="h-5 w-5" />}
              title="Letzte Eintragung Training"
              empty={recentTraining.length === 0}
              emptyText="Noch keine Trainings-Einträge"
            >
              {recentTraining.map((c) => (
                <CustomerRow
                  key={c.id}
                  id={c.id}
                  name={c.display_name ?? "Ohne Namen"}
                  meta={new Date(c.last_training_at!).toLocaleDateString("de-DE", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  tone="info"
                />
              ))}
            </Panel>
          </div>

          {/* ===== 3. UMSATZ & TRIAL ===== */}
          <SectionHeader title="Umsatz & Conversion" subtitle="Trials und Paketanfragen" />
          <CoachTrialOverview />

          {/* ===== 4. COMMUNITY & RANKINGS ===== */}
          <SectionHeader title="Community & Rankings" subtitle="Top-Athleten im Zeitraum" />
          <RankingPanel />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
      <div>
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

type ExpiringPlan = { id: string; name: string; kind: "nutrition" | "training"; end: string; days: number };
type RedClient = Client & { _score: { score: number; level: "green" | "yellow" | "red"; reasons: string[] } };

type TaskAction = "complete" | "reopen" | "snooze";

function TaskInboxCard({
  openCheckins,
  expiringPlans,
  redClients,
  states,
  onAction,
  mutating,
  onExtendPlan,
  extendingKey,
  onGenerateDraft,
  generatingKey,
  onBulkExtend,
  bulkExtendProgress,
  bulkExtending,
  onBulkDraft,
  bulkDraftProgress,
  bulkDrafting,
}: {
  openCheckins: Client[];
  expiringPlans: ExpiringPlan[];
  redClients: RedClient[];
  states: Map<string, CoachTaskState>;
  onAction: (task_key: string, action: TaskAction, snooze_hours?: number) => void;
  mutating: boolean;
  onExtendPlan: (client_id: string, kind: "nutrition" | "training", task_key: string) => void;
  extendingKey: string | null | undefined;
  onGenerateDraft: (client_id: string, task_key: string) => void;
  generatingKey: string | null | undefined;
  onBulkExtend: (items: Array<{ client_id: string; kind: "nutrition" | "training"; task_key: string }>) => void;
  bulkExtendProgress: { done: number; total: number } | null;
  bulkExtending: boolean;
  onBulkDraft: (items: Array<{ client_id: string; task_key: string }>) => void;
  bulkDraftProgress: { done: number; total: number } | null;
  bulkDrafting: boolean;
}) {
  type QuickAction = {
    label: string;
    onClick: () => void;
    loading: boolean;
  };
  type Task = {
    id: string;
    icon: React.ReactNode;
    title: string;
    meta: string;
    tone: "warn" | "danger" | "info";
    to: string;
    params?: Record<string, string>;
    quickAction?: QuickAction;
  };

  const tasks: Task[] = [];

  openCheckins.slice(0, 20).forEach((c) => {
    tasks.push({
      id: `checkin:${c.id}`,
      icon: <Clock className="h-4 w-4" />,
      title: `Check-in offen — ${c.display_name ?? "Ohne Namen"}`,
      meta: c.last_checkin
        ? `Letzter Check-in ${new Date(c.last_checkin).toLocaleDateString("de-DE")}`
        : "Noch nie eingecheckt",
      tone: "warn",
      to: "/coach/customers/$userId",
      params: { userId: c.id },
      quickAction: {
        label: "✨ Entwurf",
        onClick: () => onGenerateDraft(c.id, `checkin:${c.id}`),
        loading: generatingKey === `checkin:${c.id}`,
      },
    });
  });

  expiringPlans.slice(0, 20).forEach((p) => {
    const tk = `plan:${p.id}:${p.kind}:${p.end}`;
    tasks.push({
      id: tk,
      icon: p.kind === "nutrition" ? <Utensils className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />,
      title: `${p.kind === "nutrition" ? "Ernährungsplan" : "Trainingsplan"} ${p.days < 0 ? "abgelaufen" : `läuft in ${p.days}T aus`} — ${p.name}`,
      meta: `Ende ${new Date(p.end).toLocaleDateString("de-DE")}`,
      tone: p.days < 0 ? "danger" : "warn",
      to: "/coach/customers/$userId",
      params: { userId: p.id },
      quickAction: {
        label: "+4 Wochen",
        onClick: () => onExtendPlan(p.id, p.kind, tk),
        loading: extendingKey === tk,
      },
    });
  });

  redClients.slice(0, 10).forEach((c) => {
    tasks.push({
      id: `risk:${c.id}`,
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `🔴 ${c.display_name ?? "Ohne Namen"} braucht Aufmerksamkeit`,
      meta: c._score.reasons.slice(0, 2).join(" · ") || `Score ${c._score.score}`,
      tone: "danger",
      to: "/coach/customers/$userId",
      params: { userId: c.id },
      quickAction: {
        label: "✨ Entwurf",
        onClick: () => onGenerateDraft(c.id, `risk:${c.id}`),
        loading: generatingKey === `risk:${c.id}`,
      },
    });
  });

  const nowMs = Date.now();
  const classify = (t: Task): "open" | "snoozed" | "done" => {
    const s = states.get(t.id);
    if (!s) return "open";
    if (s.completed_at) return "done";
    if (s.snoozed_until && new Date(s.snoozed_until).getTime() > nowMs) return "snoozed";
    return "open";
  };

  const open = tasks.filter((t) => classify(t) === "open");
  const snoozed = tasks.filter((t) => classify(t) === "snoozed");
  const done = tasks.filter((t) => classify(t) === "done");

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-bold">Aufgaben-Inbox</h3>
            <p className="text-xs text-muted-foreground">
              {open.length} offen
              {snoozed.length > 0 ? ` · ${snoozed.length} später` : ""}
              {done.length > 0 ? ` · ${done.length} erledigt` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const openExtendItems = expiringPlans
              .map((p) => ({ p, tk: `plan:${p.id}:${p.kind}:${p.end}` }))
              .filter(({ tk }) => {
                const s = states.get(tk);
                if (!s) return true;
                if (s.completed_at) return false;
                if (s.snoozed_until && new Date(s.snoozed_until).getTime() > Date.now()) return false;
                return true;
              })
              .map(({ p, tk }) => ({ client_id: p.id, kind: p.kind, task_key: tk }));
            if (openExtendItems.length === 0) return null;
            return (
              <button
                type="button"
                onClick={() => onBulkExtend(openExtendItems)}
                disabled={bulkExtending}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {bulkExtending && bulkExtendProgress
                  ? `Verlängere ${bulkExtendProgress.done}/${bulkExtendProgress.total}…`
                  : `Alle Pläne +4 Wo. (${openExtendItems.length})`}
              </button>
            );
          })()}
          {(() => {
            const draftCandidates: Array<{ client_id: string; task_key: string }> = [];
            openCheckins.slice(0, 20).forEach((c) => {
              const tk = `checkin:${c.id}`;
              const s = states.get(tk);
              if (s?.completed_at) return;
              if (s?.snoozed_until && new Date(s.snoozed_until).getTime() > Date.now()) return;
              draftCandidates.push({ client_id: c.id, task_key: tk });
            });
            redClients.slice(0, 10).forEach((c) => {
              const tk = `risk:${c.id}`;
              if (draftCandidates.some((d) => d.client_id === c.id)) return;
              const s = states.get(tk);
              if (s?.completed_at) return;
              if (s?.snoozed_until && new Date(s.snoozed_until).getTime() > Date.now()) return;
              draftCandidates.push({ client_id: c.id, task_key: tk });
            });
            if (draftCandidates.length === 0) return null;
            return (
              <button
                type="button"
                onClick={() => onBulkDraft(draftCandidates)}
                disabled={bulkDrafting}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" />
                {bulkDrafting && bulkDraftProgress
                  ? `Erstelle ${bulkDraftProgress.done}/${bulkDraftProgress.total}…`
                  : `Entwürfe für alle (${draftCandidates.length})`}
              </button>
            );
          })()}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Keine offenen Aufgaben — alles erledigt 🎉
        </div>
      )}

      {tasks.length > 0 && open.length === 0 && (
        <div className="mb-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          Alle Aufgaben für jetzt abgehakt 🎉
        </div>
      )}

      <ul className="space-y-2">
        {open.map((t) => {
          const s = states.get(t.id);
          return (
            <TaskRow
              key={t.id}
              task={t}
              state="open"
              note={s?.note ?? null}
              mutating={mutating}
              onAction={(action, hours) => onAction(t.id, action, hours)}
            />
          );
        })}
        {snoozed.map((t) => {
          const s = states.get(t.id);
          return (
            <TaskRow
              key={t.id}
              task={t}
              state="snoozed"
              note={s?.snoozed_until ?? null}
              mutating={mutating}
              onAction={(action, hours) => onAction(t.id, action, hours)}
            />
          );
        })}
        {done.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            state="done"
            note={null}
            mutating={mutating}
            onAction={(action, hours) => onAction(t.id, action, hours)}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  state,
  note,
  mutating,
  onAction,
}: {
  task: {
    id: string;
    icon: React.ReactNode;
    title: string;
    meta: string;
    tone: "warn" | "danger" | "info";
    to: string;
    params?: Record<string, string>;
    quickAction?: { label: string; onClick: () => void; loading: boolean };
  };
  state: "open" | "snoozed" | "done";
  note: string | null;
  mutating: boolean;
  onAction: (action: TaskAction, snooze_hours?: number) => void;
}) {
  const done = state === "done";
  const snoozed = state === "snoozed";
  const toneClasses =
    task.tone === "danger"
      ? "border-red-500/30 bg-red-500/5"
      : task.tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-background/30";
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        done
          ? "border-border/40 bg-background/20 opacity-60"
          : snoozed
            ? "border-border/40 bg-background/30 opacity-70"
            : toneClasses
      }`}
    >
      <button
        type="button"
        onClick={() => onAction(done ? "reopen" : "complete")}
        disabled={mutating}
        aria-label={done ? "Wieder öffnen" : "Als erledigt markieren"}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${
          done
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
            : "border-border hover:border-gold/60"
        }`}
      >
        {done && <CheckCircle2 className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${done ? "line-through" : ""}`}>{task.title}</p>
        <p className="text-xs text-muted-foreground">{task.meta}</p>
        {snoozed && note && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            <Moon className="mr-1 inline h-3 w-3" />
            Wieder aktiv: {new Date(note).toLocaleString("de-DE")}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {!done && !snoozed && task.quickAction && (
          <button
            type="button"
            onClick={task.quickAction.onClick}
            disabled={mutating || task.quickAction.loading}
            className="rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
          >
            {task.quickAction.loading ? "…" : task.quickAction.label}
          </button>
        )}
        {!done && !snoozed && (
          <button
            type="button"
            onClick={() => onAction("snooze", 24)}
            disabled={mutating}
            title="24 Stunden ausblenden"
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:border-gold/40 hover:text-foreground disabled:opacity-50"
          >
            <Moon className="inline h-3 w-3" /> 24h
          </button>
        )}
        {snoozed && (
          <button
            type="button"
            onClick={() => onAction("reopen")}
            disabled={mutating}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:border-gold/40 hover:text-foreground disabled:opacity-50"
          >
            Jetzt zeigen
          </button>
        )}
        <Link
          to={task.to}
          params={task.params as never}
          className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
        >
          Öffnen <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}


function CoachScoreCard({
  counts,
  total,
  redClients,
}: {
  counts: { green: number; yellow: number; red: number };
  total: number;
  redClients: Array<Client & { _score: { score: number; level: "green" | "yellow" | "red"; reasons: string[] } }>;
}) {
  if (total === 0) return null;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gold">📊</span>
        <h2 className="font-display text-lg font-bold">Coach Score</h2>
        <span className="text-xs text-muted-foreground">· {total} Kunden</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreStat color="emerald" emoji="🟢" label="Auf Kurs" value={counts.green} pct={pct(counts.green)} />
        <ScoreStat color="yellow" emoji="🟡" label="Beobachten" value={counts.yellow} pct={pct(counts.yellow)} />
        <ScoreStat color="red" emoji="🔴" label="Handlungsbedarf" value={counts.red} pct={pct(counts.red)} />
      </div>
      {redClients.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Akut handeln
          </p>
          <div className="space-y-2">
            {redClients.slice(0, 6).map((c) => (
              <CustomerRow
                key={c.id}
                id={c.id}
                name={c.display_name ?? "Ohne Namen"}
                warn
                scoreLevel="red"
                scoreValue={c._score.score}
                meta={c._score.reasons.slice(0, 3).join(" · ") || "Mehrere Risiken"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreStat({
  color,
  emoji,
  label,
  value,
  pct,
}: {
  color: "emerald" | "yellow" | "red";
  emoji: string;
  label: string;
  value: number;
  pct: number;
}) {
  const bar =
    color === "emerald" ? "bg-emerald-500" : color === "yellow" ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <div className="font-display text-2xl font-bold">{value}</div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted-foreground">{pct}%</div>
    </div>
  );
}

function ActionNeededHero({
  openCheckins,
  expiringPlans,
  inactive,
  newLeads,
}: {
  openCheckins: number;
  expiringPlans: number;
  inactive: number;
  newLeads: number;
}) {
  const total = openCheckins + expiringPlans + inactive + newLeads;
  const allClear = total === 0;
  return (
    <div
      className={`rounded-2xl border p-5 ${
        allClear
          ? "border-gold/30 bg-gradient-to-br from-gold/5 to-transparent"
          : "border-warning/40 bg-warning/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            allClear ? "bg-gold/15 text-gold" : "bg-warning/15 text-warning"
          }`}
        >
          {allClear ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Handlungsbedarf
          </p>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {allClear ? "Alles im grünen Bereich" : `${total} Aufgabe${total === 1 ? "" : "n"} offen`}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <HeroChip label="Check-ins" value={openCheckins} warn />
            <HeroChip label="Pläne laufen aus" value={expiringPlans} warn />
            <HeroChip label="Inaktiv 14+ T." value={inactive} warn />
            <HeroChip label="Neue Anfragen" value={newLeads} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroChip({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const active = value > 0;
  return (
    <span
      className={`rounded-lg border px-2.5 py-1 text-xs ${
        active && warn
          ? "border-warning/40 bg-warning/10 text-warning"
          : active
            ? "border-gold/40 bg-gold/10 text-gold"
            : "border-border bg-background/40 text-muted-foreground"
      }`}
    >
      <span className="font-display text-sm font-bold">{value}</span>{" "}
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function RankingPanel() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const getRankingFn = useServerFn(getRanking);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-ranking", period],
    queryFn: () => getRankingFn({ data: { period } }),
  });
  const rows = (data ?? []).filter((r) => r.points > 0);

  const PERIOD_LABEL: Record<RankingPeriod, string> = {
    today: "Heute",
    week: "Diese Woche",
    month: "Diesen Monat",
    all: "Allzeit",
  };

  const medal = (idx: number) =>
    idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Ranking</h2>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as RankingPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Heute</SelectItem>
            <SelectItem value="week">Diese Woche</SelectItem>
            <SelectItem value="month">Diesen Monat</SelectItem>
            <SelectItem value="all">Allzeit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Lade…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" />
          Noch keine Punkte im Zeitraum „{PERIOD_LABEL[period]}".
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <Link
              key={r.user_id}
              to="/coach/customers/$userId"
              params={{ userId: r.user_id }}
              className={`flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-gold/40 ${
                i === 0 ? "border-gold/40" : "border-border"
              }`}
            >
              <div className="w-8 shrink-0 text-center text-lg font-bold">
                {medal(i)}
              </div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                {(r.display_name ?? "??").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                {r.display_name ?? "Ohne Namen"}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-base font-bold text-gold">
                  {r.points}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Punkte
                </div>
              </div>
            </Link>
          ))}
        </ol>
      )}
    </div>
  );
}


function StatPill({
  icon,
  value,
  label,
  warn,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        warn ? "border-warning/40 bg-warning/10" : "border-border bg-card"
      }`}
    >
      <span className={warn ? "text-warning" : "text-gold"}>{icon}</span>
      <span className="font-display text-lg font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
  empty,
  emptyText,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gold">{icon}</span>
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      {empty ? (
        <div className="flex items-center gap-2 rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" />
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

function CustomerRow({
  id,
  name,
  meta,
  warn,
  tone,
  kcalDev,
  kcalDir,
  plateauDays,
  scoreLevel,
  scoreValue,
}: {
  id: string;
  name: string;
  meta: string;
  warn?: boolean;
  tone?: "info";
  kcalDev?: number | null;
  kcalDir?: "over" | "under" | null;
  plateauDays?: number | null;
  scoreLevel?: "green" | "yellow" | "red" | null;
  scoreValue?: number | null;
}) {
  const kcalLevel: "ok" | "warn" | "bad" | null =
    kcalDev == null ? null : kcalDev <= 200 ? "ok" : kcalDev <= 500 ? "warn" : "bad";
  const dotColor =
    scoreLevel === "green"
      ? "bg-emerald-500"
      : scoreLevel === "yellow"
        ? "bg-yellow-500"
        : scoreLevel === "red"
          ? "bg-red-500"
          : null;
  return (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: id }}
      className={`flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-gold/40 ${
        warn ? "border-warning/30" : "border-border"
      }`}
    >
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
        {name.slice(0, 2).toUpperCase()}
        {dotColor && (
          <span
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-card ${dotColor}`}
            title={`Coach Score: ${scoreValue ?? "?"}/100`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold">{name}</div>
          {kcalLevel && kcalLevel !== "ok" && (
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                kcalLevel === "warn"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-red-500/40 bg-red-500/10 text-red-400"
              }`}
              title={`Plan ${kcalDir === "over" ? "über" : "unter"} Kalorienziel`}
            >
              {kcalDir === "over" ? "+" : "−"}
              {kcalDev} kcal
            </span>
          )}
          {plateauDays != null && (
            <span
              className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400"
              title={`Gewicht stagniert seit ~${plateauDays} Tagen — Kalorien anpassen`}
            >
              ⚠️ Plateau {plateauDays}T
            </span>
          )}
        </div>
        <div
          className={`truncate text-xs ${
            warn ? "text-warning" : tone === "info" ? "text-gold" : "text-muted-foreground"
          }`}
        >
          {meta}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}


function PlanValidity({ label, end }: { label: string; end: string | null }) {
  if (!end) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-semibold text-muted-foreground">—</div>
      </div>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  const days = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  const tone =
    days < 0 ? "text-warning" : days <= 5 ? "text-warning" : "text-foreground";
  const note =
    days < 0
      ? `abgelaufen (vor ${Math.abs(days)} T.)`
      : days === 0
        ? "läuft heute aus"
        : `noch ${days} T.`;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-semibold ${tone}`}>
        bis {endDate.toLocaleDateString("de-DE")}
      </div>
      <div className={`text-[10px] ${tone}`}>{note}</div>
    </div>
  );
}

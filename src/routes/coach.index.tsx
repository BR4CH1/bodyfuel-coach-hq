import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";


import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { CoachTrialOverview } from "@/components/bodyfuel/CoachTrialOverview";
import { supabase } from "@/integrations/supabase/client";
import { getRanking, type RankingPeriod } from "@/lib/coaching.functions";
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
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
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
        (measurements.data ?? []).forEach((m) => {
          if (!lastWeight.has(m.user_id))
            lastWeight.set(m.user_id, { w: m.weight_kg, at: m.measured_at });
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Diese Woche offen */}
          <Panel
            icon={<Clock className="h-5 w-5" />}
            title="Diese Woche noch offen"
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

          {/* Inaktiv-Warnung */}
          <Panel
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Inaktiv (14+ Tage)"
            empty={inactive.length === 0}
            emptyText="Niemand inaktiv. Top!"
          >
            {inactive.slice(0, 8).map((c) => (
              <CustomerRow
                key={c.id}
                id={c.id}
                name={c.display_name ?? "Ohne Namen"}
                warn
                meta={
                  c.days === null
                    ? "Noch nie eingecheckt"
                    : `Vor ${c.days} Tagen zuletzt aktiv`
                }
              />
            ))}
          </Panel>

          {/* Plan-Warnungen */}
          <Panel
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Pläne laufen aus (≤ 5 Tage)"
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

          {/* Plan-Übersicht */}
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

          {/* Aktuelle Maße */}
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

          {/* Letzte Eintragung Ernährung */}
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

          {/* Letzte Eintragung Training */}
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

          {/* Trial-Übersicht */}
          <div className="lg:col-span-2">
            <CoachTrialOverview />
          </div>

          {/* Ranking */}
          <div className="lg:col-span-2">
            <RankingPanel />
          </div>


        </div>
      )}
    </div>
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
}: {
  id: string;
  name: string;
  meta: string;
  warn?: boolean;
  tone?: "info";
  kcalDev?: number | null;
  kcalDir?: "over" | "under" | null;
}) {
  const kcalLevel: "ok" | "warn" | "bad" | null =
    kcalDev == null ? null : kcalDev <= 200 ? "ok" : kcalDev <= 500 ? "warn" : "bad";
  return (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: id }}
      className={`flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-gold/40 ${
        warn ? "border-warning/30" : "border-border"
      }`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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

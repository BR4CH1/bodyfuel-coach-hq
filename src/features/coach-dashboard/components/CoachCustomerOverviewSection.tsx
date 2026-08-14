import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, CalendarClock, ChevronRight, Search } from "lucide-react";

import {
  CoachScoreCard,
  SectionHeader,
} from "@/features/coach-dashboard/components/CoachDashboardPrimitives";
import { daysAgo, daysUntil } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import type {
  CoachClient,
  CoachScore,
  CoachScoreLevel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

type CustomerFilter = "all" | "risk" | "checkin" | "plan" | "inactive";

export function CoachCustomerOverviewSection({
  clients,
  scoreCounts,
  scoreById,
}: {
  clients: CoachClient[];
  scoreCounts: Record<CoachScoreLevel, number>;
  scoreById: Map<string, CoachScore>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");

    return clients
      .filter((client) => {
        const name = (client.display_name ?? "Ohne Namen").toLocaleLowerCase("de-DE");
        if (normalizedQuery && !name.includes(normalizedQuery)) return false;

        const score = scoreById.get(client.id);
        const activityDays = latestActivityDays(client);
        const plan = earliestPlan(client, today);

        if (filter === "risk") return score?.level === "red";
        if (filter === "checkin") return Boolean(client.pending_checkin_submitted_at);
        if (filter === "plan") return plan !== null && plan.days <= 5;
        if (filter === "inactive") return activityDays === null || activityDays >= 14;
        return true;
      })
      .sort((left, right) => {
        const scoreRank = (client: CoachClient) => {
          const level = scoreById.get(client.id)?.level;
          return level === "red" ? 0 : level === "yellow" ? 1 : 2;
        };
        const rankDiff = scoreRank(left) - scoreRank(right);
        if (rankDiff !== 0) return rankDiff;

        const pendingDiff = Number(Boolean(right.pending_checkin_submitted_at)) - Number(Boolean(left.pending_checkin_submitted_at));
        if (pendingDiff !== 0) return pendingDiff;

        const leftPlan = earliestPlan(left, today)?.days ?? Number.POSITIVE_INFINITY;
        const rightPlan = earliestPlan(right, today)?.days ?? Number.POSITIVE_INFINITY;
        if (leftPlan !== rightPlan) return leftPlan - rightPlan;

        return (left.display_name ?? "").localeCompare(right.display_name ?? "", "de");
      });
  }, [clients, filter, query, scoreById, today]);

  return (
    <>
      <SectionHeader
        title="Alle Coaching-Kunden"
        subtitle="Ein Kunde, ein Status, alle relevanten Signale"
      />
      <CoachScoreCard counts={scoreCounts} total={clients.length} redClients={[]} />

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kunde suchen…"
              className="h-10 w-full rounded-xl border border-border bg-background/60 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>Alle</FilterPill>
            <FilterPill active={filter === "risk"} onClick={() => setFilter("risk")}>🔴 Risiko</FilterPill>
            <FilterPill active={filter === "checkin"} onClick={() => setFilter("checkin")}>Check-in offen</FilterPill>
            <FilterPill active={filter === "plan"} onClick={() => setFilter("plan")}>Plan ≤ 5 Tage</FilterPill>
            <FilterPill active={filter === "inactive"} onClick={() => setFilter("inactive")}>14+ Tage inaktiv</FilterPill>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
            Keine Kunden für diesen Filter.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 md:hidden">
              {rows.map((client) => (
                <CustomerMobileCard key={client.id} client={client} score={scoreById.get(client.id)} today={today} />
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/55 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5">Kunde</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Check-in</th>
                    <th className="px-3 py-2.5">Letzte Aktivität</th>
                    <th className="px-3 py-2.5">Gewicht</th>
                    <th className="px-3 py-2.5">Nächster Plan</th>
                    <th className="px-3 py-2.5 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((client) => {
                    const score = scoreById.get(client.id);
                    return (
                      <tr key={client.id} className="border-b border-border/70 last:border-0 hover:bg-background/45">
                        <td className="px-3 py-3 font-semibold">{client.display_name ?? "Ohne Namen"}</td>
                        <td className="px-3 py-3"><StatusBadge score={score} /></td>
                        <td className="px-3 py-3 text-xs">{checkinLabel(client)}</td>
                        <td className="px-3 py-3 text-xs">{activityLabel(client)}</td>
                        <td className="px-3 py-3 text-xs">{weightLabel(client)}</td>
                        <td className="px-3 py-3 text-xs"><PlanLabel client={client} today={today} /></td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            to="/coach/customers/$userId"
                            params={{ userId: client.id }}
                            className="inline-flex items-center text-xs font-semibold text-gold hover:underline"
                          >
                            Öffnen <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-gold/60 bg-gold/12 text-gold"
          : "border-border text-muted-foreground hover:border-gold/35 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CustomerMobileCard({
  client,
  score,
  today,
}: {
  client: CoachClient;
  score?: CoachScore;
  today: Date;
}) {
  return (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: client.id }}
      className="rounded-xl border border-border bg-background/45 p-3 transition hover:border-gold/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{client.display_name ?? "Ohne Namen"}</div>
          <div className="mt-1"><StatusBadge score={score} /></div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Check-in" value={checkinLabel(client)} />
        <MiniStat label="Aktivität" value={activityLabel(client)} />
        <MiniStat label="Gewicht" value={weightLabel(client)} />
        <MiniStat label="Plan" value={<PlanLabel client={client} today={today} />} />
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ score }: { score?: CoachScore }) {
  const level = score?.level ?? "green";
  const label = level === "red" ? "Handlungsbedarf" : level === "yellow" ? "Beobachten" : "Auf Kurs";
  const tone =
    level === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-500"
      : level === "yellow"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";

  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>
      {label}{score ? ` · ${score.score}` : ""}
    </span>
  );
}

function checkinLabel(client: CoachClient) {
  if (client.pending_checkin_submitted_at) {
    return `wartet seit ${new Date(client.pending_checkin_submitted_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  }
  if (client.last_checkin) {
    return new Date(client.last_checkin).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
  return "noch nie";
}

function latestActivity(client: CoachClient) {
  const candidates = [
    { date: client.last_training_at, label: "Training" },
    { date: client.last_nutrition_at, label: "Ernährung" },
    { date: client.last_weight_at, label: "Messung" },
  ].filter((item): item is { date: string; label: string } => Boolean(item.date));

  if (candidates.length === 0) return null;
  return candidates.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
}

function latestActivityDays(client: CoachClient) {
  const activity = latestActivity(client);
  return activity ? daysAgo(activity.date) : null;
}

function activityLabel(client: CoachClient) {
  const activity = latestActivity(client);
  if (!activity) return "keine Aktivität";
  const days = daysAgo(activity.date);
  return `${activity.label} · ${days === 0 ? "heute" : days === 1 ? "gestern" : `vor ${days} T.`}`;
}

function weightLabel(client: CoachClient) {
  if (client.last_weight == null) return "—";
  return `${client.last_weight} kg${client.last_weight_at ? ` · ${new Date(client.last_weight_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}` : ""}`;
}

function earliestPlan(client: CoachClient, today: Date) {
  const plans = [
    client.training_plan_end
      ? { kind: "Training", end: client.training_plan_end, days: daysUntil(client.training_plan_end, today) }
      : null,
    client.nutrition_plan_end
      ? { kind: "Ernährung", end: client.nutrition_plan_end, days: daysUntil(client.nutrition_plan_end, today) }
      : null,
  ].filter((plan): plan is { kind: string; end: string; days: number } => Boolean(plan));

  if (plans.length === 0) return null;
  return plans.sort((left, right) => left.days - right.days)[0];
}

function PlanLabel({ client, today }: { client: CoachClient; today: Date }) {
  const plan = earliestPlan(client, today);
  if (!plan) return <span>—</span>;

  const warning = plan.days <= 5;
  const time =
    plan.days < 0
      ? `seit ${Math.abs(plan.days)} T. abgelaufen`
      : plan.days === 0
        ? "heute"
        : `in ${plan.days} T.`;

  return (
    <span className={cn("inline-flex items-center gap-1", warning && "font-semibold text-amber-500")}>
      {warning ? <CalendarClock className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
      {plan.kind} · {time}
    </span>
  );
}

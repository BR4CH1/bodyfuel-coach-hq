import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { getPlanValidity } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import type { CoachScoreLevel, ScoredCoachClient } from "@/features/coach-dashboard/types";

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
      <div>
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function StatPill({
  icon,
  value,
  label,
  warn,
}: {
  icon: ReactNode;
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

export function Panel({
  icon,
  title,
  children,
  empty,
  emptyText,
  footer,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  empty: boolean;
  emptyText: string;
  footer?: ReactNode;
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

export function CustomerRow({
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
  scoreLevel?: CoachScoreLevel | null;
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

export function PlanValidity({ label, end }: { label: string; end: string | null }) {
  const validity = getPlanValidity(end);
  if (!validity.endDate) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-semibold text-muted-foreground">—</div>
      </div>
    );
  }

  const tone = validity.warning ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-semibold ${tone}`}>
        bis {validity.endDate.toLocaleDateString("de-DE")}
      </div>
      <div className={`text-[10px] ${tone}`}>{validity.note}</div>
    </div>
  );
}

function ScoreStat({
  color,
  emoji,
  label,
  value,
  percentage,
}: {
  color: "emerald" | "yellow" | "red";
  emoji: string;
  label: string;
  value: number;
  percentage: number;
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
        <div className={`h-full ${bar}`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted-foreground">{percentage}%</div>
    </div>
  );
}

export function CoachScoreCard({
  counts,
  total,
  redClients,
}: {
  counts: Record<CoachScoreLevel, number>;
  total: number;
  redClients: ScoredCoachClient[];
}) {
  if (total === 0) return null;
  const percentage = (value: number) => Math.round((value / total) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gold">📊</span>
        <h2 className="font-display text-lg font-bold">Coach Score</h2>
        <span className="text-xs text-muted-foreground">· {total} Kunden</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreStat
          color="emerald"
          emoji="🟢"
          label="Auf Kurs"
          value={counts.green}
          percentage={percentage(counts.green)}
        />
        <ScoreStat
          color="yellow"
          emoji="🟡"
          label="Beobachten"
          value={counts.yellow}
          percentage={percentage(counts.yellow)}
        />
        <ScoreStat
          color="red"
          emoji="🔴"
          label="Handlungsbedarf"
          value={counts.red}
          percentage={percentage(counts.red)}
        />
      </div>
      {redClients.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Akut handeln
          </p>
          <div className="space-y-2">
            {redClients.slice(0, 6).map((client) => (
              <CustomerRow
                key={client.id}
                id={client.id}
                name={client.display_name ?? "Ohne Namen"}
                warn
                scoreLevel="red"
                scoreValue={client._score.score}
                meta={client._score.reasons.slice(0, 3).join(" · ") || "Mehrere Risiken"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

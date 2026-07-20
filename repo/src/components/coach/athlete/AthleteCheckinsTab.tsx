import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Heart, Scale, HeartPulse, ShieldAlert } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import {
  listAthleteCheckins,
  type AthleteCheckin,
} from "@/lib/athlete-checkins.functions";
import {
  listRecentReadinessGateEvents,
  type ReadinessGateEvent,
} from "@/lib/readiness-gate-events.functions";
import { MiniLine, Section, TinyMetric } from "./athlete-tab-shared";
import { ReadinessInsight } from "@/components/readiness/ReadinessInsight";
import { recoveryAfterGate } from "@/lib/readiness";

const SCALE_LABEL = ["—", "sehr niedrig", "niedrig", "mittel", "hoch", "sehr hoch"];

function scale(v: number | null): string {
  if (v == null) return "—";
  return `${v} / 5`;
}

export function AthleteCheckinsTab({
  data,
  userId,
  focus,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
  focus?: string;
}) {
  const a = data.athlete;
  const readinessRef = useRef<HTMLDivElement | null>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (focus !== "readiness") return;
    const el = readinessRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 2400);
    }, 150);
    return () => window.clearTimeout(t);
  }, [focus]);
  const listFn = useServerFn(listAthleteCheckins);
  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["athlete-checkins", userId],
    queryFn: () => listFn({ data: { userId } }) as Promise<AthleteCheckin[]>,
  });

  const gatesFn = useServerFn(listRecentReadinessGateEvents);
  const { data: gateEvents = [] } = useQuery({
    queryKey: ["athlete-readiness-gates", userId],
    queryFn: () =>
      gatesFn({ data: { userId, days: 14 } }) as Promise<ReadinessGateEvent[]>,
  });

  const points = data.weight_series.map((w) => ({
    t: new Date(w.measured_at).getTime(),
    v: w.weight_kg,
  }));
  const latest = checkins[0];

  return (
    <div className="space-y-4">
      {checkins.length > 0 && (
        <Section title="Readiness" icon={<HeartPulse className="h-4 w-4" />}>
          <ReadinessInsight rows={checkins} tone="coach" />
        </Section>
      )}

      {gateEvents.length > 0 && (
        <Section
          title="Readiness bremst Progression"
          icon={<ShieldAlert className="h-4 w-4" />}
        >
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
            <div className="text-[12px] text-orange-300">
              In den letzten 14 Tagen wurden {gateEvents.length} Progressions-Entscheidungen
              durch die Readiness konservativer gesetzt. Keine parallele Plan-Änderung — nur
              Steigerungen wurden zurückgehalten.
            </div>

            <div
              ref={readinessRef}
              className={`scroll-mt-24 rounded-md transition-shadow duration-500 ${
                highlight
                  ? "ring-2 ring-orange-400/70 ring-offset-2 ring-offset-[#050505]"
                  : ""
              }`}
            >
              <GateSparkline events={gateEvents} days={14} />
              <RecoveryAfterGate events={gateEvents} checkins={checkins} />
            </div>

            <ul className="mt-2 divide-y divide-orange-500/20">
              {gateEvents.slice(0, 6).map((g) => (
                <li key={g.id} className="py-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {g.exercise_name ?? "Übung"}
                    </span>
                    <span
                      className={
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        (g.readiness_gate === "reduce"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-yellow-500/20 text-yellow-300")
                      }
                    >
                      {g.readiness_gate === "reduce" ? "Hart" : "Weich"}
                    </span>
                  </div>
                  {g.readiness_gate_reason && (
                    <div className="mt-0.5 text-muted-foreground">
                      {g.readiness_gate_reason}
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(g.source_session_date).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })}{" "}
                    · Entscheidung: {g.decision}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}


      <Section title="Aktueller Check-in" icon={<Heart className="h-4 w-4" />}>
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            Lädt…
          </div>
        ) : !latest ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Noch keine Check-ins vorhanden.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {new Date(latest.checkin_date).toLocaleDateString("de-DE", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MiniField label="Schlaf" value={scale(latest.sleep)} />
              <MiniField label="Energie" value={scale(latest.energy)} />
              <MiniField label="Stress" value={scale(latest.stress)} />
              <MiniField label="Training" value={scale(latest.training_feel)} />
              <MiniField
                label="Schmerzen"
                value={latest.pain_level != null ? `${latest.pain_level} / 5` : "—"}
              />
              <MiniField
                label="Gewicht"
                value={latest.weight_kg != null ? `${latest.weight_kg} kg` : "—"}
              />
            </div>
            {latest.pain_note && (
              <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 text-[12px] text-orange-400">
                Beschwerden: {latest.pain_note}
              </div>
            )}
            {latest.notes && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[13px] leading-relaxed">
                {latest.notes}
              </div>
            )}
          </div>
        )}
      </Section>

      {checkins.length > 1 && (
        <Section title="Verlauf" icon={<Heart className="h-4 w-4" />}>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {checkins.slice(1).map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>
                    {new Date(c.checkin_date).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                  <span>
                    S{c.sleep ?? "–"} · E{c.energy ?? "–"} · St{c.stress ?? "–"} · T{c.training_feel ?? "–"}
                    {c.pain_level != null && c.pain_level > 0 ? ` · Schmerz ${c.pain_level}` : ""}
                  </span>
                </div>
                {c.notes && (
                  <div className="mt-1 truncate text-[13px] text-muted-foreground">{c.notes}</div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Körperdaten" icon={<Scale className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <TinyMetric
            label="Körpergröße"
            value={a.height_cm != null ? `${a.height_cm} cm` : "—"}
          />
          <TinyMetric
            label="Aktuelles Gewicht"
            value={a.current_weight_kg != null ? `${a.current_weight_kg.toFixed(1)} kg` : "—"}
          />
        </div>
        {points.length > 0 && (
          <div className="mt-3">
            <MiniLine
              label="Gewichtsverlauf"
              unit="kg"
              points={points}
              trend={data.weight_trend_kg_30d}
              trendLabel="30 Tage"
            />
          </div>
        )}
      </Section>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function GateSparkline({ events, days }: { events: ReadinessGateEvent[]; days: number }) {
  // Bucket events per day (last N days). Bar color: red = reduce, yellow = hold.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: Array<{ date: Date; hard: number; soft: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, hard: 0, soft: 0 });
  }
  for (const e of events) {
    const t = new Date(e.source_session_date);
    t.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.date.getTime() === t.getTime());
    if (!b) continue;
    if (e.readiness_gate === "reduce") b.hard += 1;
    else b.soft += 1;
  }
  const max = Math.max(1, ...buckets.map((b) => b.hard + b.soft));
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Verlauf (14 Tage)
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 36 }}>
        {buckets.map((b, i) => {
          const total = b.hard + b.soft;
          const h = (total / max) * 32;
          return (
            <div
              key={i}
              title={`${b.date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · ${b.hard} hart, ${b.soft} weich`}
              className="flex-1 rounded-sm bg-muted/30"
              style={{ height: 32, display: "flex", flexDirection: "column-reverse" }}
            >
              {b.hard > 0 && (
                <div
                  className="bg-red-500/70"
                  style={{ height: (b.hard / max) * 32 }}
                />
              )}
              {b.soft > 0 && (
                <div
                  className="bg-yellow-500/70"
                  style={{ height: (b.soft / max) * 32 }}
                />
              )}
              {total === 0 && <div style={{ height: h }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecoveryAfterGate({
  events,
  checkins,
}: {
  events: ReadinessGateEvent[];
  checkins: AthleteCheckin[];
}) {
  const rec = recoveryAfterGate(
    events.map((e) => e.source_session_date),
    checkins,
  );
  if (!rec) return null;
  const { before: b, after: a, delta } = rec;
  const positive = delta > 3;
  return (
    <div className="mt-3 rounded-md border border-orange-500/20 bg-background/40 p-2 text-[12px]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Recovery nach Gate
      </div>
      <div className="mt-1">
        Ø 7d vor Bremse: <b>{b}</b> → 7d nach Bremse: <b>{a}</b>{" "}
        <span className={positive ? "text-green-400" : delta < -3 ? "text-red-400" : "text-muted-foreground"}>
          ({delta > 0 ? "+" : ""}
          {delta})
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {positive
          ? "Bremse wirkt: Readiness erholt sich."
          : delta < -3
            ? "Trotz Bremse fällt Readiness weiter — Rücksprache empfohlen."
            : "Stabil — Bremse hält Verschlechterung auf."}
      </div>
    </div>
  );
}

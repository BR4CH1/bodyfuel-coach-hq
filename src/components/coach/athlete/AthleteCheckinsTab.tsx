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

const SCALE_LABEL = ["—", "sehr niedrig", "niedrig", "mittel", "hoch", "sehr hoch"];

function scale(v: number | null): string {
  if (v == null) return "—";
  return `${v} / 5`;
}

export function AthleteCheckinsTab({
  data,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const a = data.athlete;
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

            <GateSparkline events={gateEvents} days={14} />
            <RecoveryAfterGate events={gateEvents} checkins={checkins} />

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

// re-export to satisfy potential unused import warning
export { SCALE_LABEL as _SCALE_LABEL };

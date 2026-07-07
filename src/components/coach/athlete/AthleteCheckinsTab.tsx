import { Heart, Scale } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { MiniLine, Section, TinyMetric } from "./athlete-tab-shared";

export function AthleteCheckinsTab({ data }: { data: CoachAthleteDetail }) {
  const a = data.athlete;
  const points = data.weight_series.map((w) => ({
    t: new Date(w.measured_at).getTime(),
    v: w.weight_kg,
  }));

  return (
    <div className="space-y-4">
      <Section title="Check-ins" icon={<Heart className="h-4 w-4" />}>
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Noch keine strukturierten Check-ins vorhanden.
          <div className="mt-1 text-[11px]">
            Sobald Athleten wöchentliche Check-ins (Schlaf, Energie, Stress, Beschwerden, Freitext)
            ausfüllen, erscheinen sie hier mit Verlauf.
          </div>
        </div>
      </Section>

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
        {a.weight_measured_at && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            zuletzt aktualisiert:{" "}
            {new Date(a.weight_measured_at).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
        )}
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

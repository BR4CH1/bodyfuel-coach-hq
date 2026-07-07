import { Link } from "@tanstack/react-router";
import { Dumbbell, Gauge } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { Section, TrendChip } from "./athlete-tab-shared";

export function AthletePerformanceTab({
  data,
  orgId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
}) {
  const s = data.strength;
  return (
    <div className="space-y-4">
      <Section title="Performance Score" icon={<Gauge className="h-4 w-4" />}>
        {!s ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Noch kein Performance-Test-Ergebnis vorhanden.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Overall
                </div>
                <div className="font-display text-3xl font-bold">{s.overall ?? "—"}</div>
                {s.last_test_at && (
                  <div className="text-[11px] text-muted-foreground">
                    letzte Testung:{" "}
                    {new Date(s.last_test_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
              {s.overall_delta != null && <TrendChip delta={s.overall_delta} suffix=" Pkt" />}
            </div>
          </div>
        )}
      </Section>

      {s && (
        <Section title="Kategorien" icon={<Dumbbell className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2">
            {s.categories.map((c) => (
              <div key={c.key} className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-1 flex items-end justify-between">
                  <div className="font-display text-xl font-bold">{c.score ?? "—"}</div>
                  {c.delta != null ? <TrendChip delta={c.delta} suffix="" /> : null}
                </div>
                {c.confidence != null && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Confidence: {Math.round(c.confidence * 100)} %
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
          Bulls Performance Tests
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Einreichungen bestätigen, korrigieren oder ablehnen erfolgt zentral im Coach-Bereich
          „Performance Tests“.
        </p>
        <Link
          to="/coach/bulls-performance"
          className="mt-3 inline-flex rounded-lg border border-primary bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
        >
          Zum Prüfbereich
        </Link>
      </div>
    </div>
  );
}

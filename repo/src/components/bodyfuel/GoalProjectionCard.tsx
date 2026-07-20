import { Target } from "lucide-react";
import {
  computeGoalHint,
  buildCalorieTimeline,
  type GoalProfile,
} from "@/lib/bodyfuel/goalProjection";

type Props = {
  profile: GoalProfile;
  currentWeight: number | null | undefined;
  title?: string;
};

export function GoalProjectionCard({ profile, currentWeight, title = "Zielprognose & Kalorienpfad" }: Props) {
  const hint = computeGoalHint(currentWeight, profile);
  const timeline = buildCalorieTimeline(currentWeight, profile, hint, 5);

  if (!hint) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2 text-gold">
          <Target className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sobald aktuelles Gewicht, Wunschgewicht und Zieldatum hinterlegt sind, erscheint hier die Prognose.
        </p>
      </div>
    );
  }

  const tone =
    hint.intensity === "aggressiv"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : hint.intensity === "ambitioniert"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-gold">
        <Target className="h-5 w-5" />
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${tone}`}>
        <p className="font-semibold">
          Geschätztes Kalorienziel: ~{hint.kcal} kcal/Tag · {hint.isLoss ? "Abnahme" : "Aufbau"} ca. {Math.abs(hint.rate).toFixed(2)} kg/Woche
          ({hint.ratePctWeek.toFixed(2)}% KG) · Intensität: {hint.intensity}
        </p>
        {hint.clamped && (
          <p className="mt-1 text-xs opacity-90">
            Hinweis: Der Zeitraum wäre rechnerisch noch härter – Defizit/Überschuss wurde auf ein sicheres Maximum begrenzt.
          </p>
        )}
        <p className="mt-1 text-xs opacity-80">
          Zeitraum: ca. {hint.weeks} Wochen · Tagesdelta: {hint.delta > 0 ? "+" : ""}{hint.delta} kcal · TDEE heute: ~{Math.round(hint.tdee)} kcal
        </p>
      </div>

      {timeline.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Kalorien-Timeline · alle 5&nbsp;kg {hint.isLoss ? "Abnahme" : "Zunahme"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Meilenstein</th>
                  <th className="py-2 pr-3">Gewicht</th>
                  <th className="py-2 pr-3">ETA</th>
                  <th className="py-2 pr-3">Wochen</th>
                  <th className="py-2 pr-3">TDEE</th>
                  <th className="py-2 pr-3">Kalorienziel</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((s, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">
                      {s.deltaKg > 0 ? "+" : ""}{s.deltaKg.toFixed(1)} kg
                    </td>
                    <td className="py-2 pr-3">{s.weight.toFixed(1)} kg</td>
                    <td className="py-2 pr-3">{new Date(s.etaDate).toLocaleDateString("de-DE")}</td>
                    <td className="py-2 pr-3">{s.weeksFromNow}</td>
                    <td className="py-2 pr-3">~{Math.round(s.tdee)}</td>
                    <td className="py-2 pr-3 font-semibold text-foreground">~{s.kcal} kcal</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Annahme: tägliches Kaloriendelta bleibt konstant; TDEE wird mit dem jeweiligen Meilenstein-Gewicht neu berechnet.
          </p>
        </div>
      )}
    </div>
  );
}

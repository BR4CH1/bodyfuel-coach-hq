import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { listNutritionAdjustmentsForAthlete } from "@/lib/organizations/nutrition-plan-adjustments.functions";
import { Section } from "./athlete-tab-shared";

const REASON_LABELS: Record<string, string> = {
  matchday_context: "Spieltag-Kontext",
  intensity_increase: "höhere Belastung",
  intensity_decrease: "reduzierte Belastung",
  recovery_context: "Regeneration",
  manual_override: "eigene Anpassung",
  md_minus_1_pre_fuel: "Pre-Fuel vor Spiel",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NutritionAutoAdjustmentsCard({ userId }: { userId: string }) {
  const fn = useServerFn(listNutritionAdjustmentsForAthlete);
  const q = useQuery({
    queryKey: ["nutrition-auto-adjustments", userId],
    queryFn: () => fn({ data: { userId, limit: 15 } }),
  });

  const rows = q.data ?? [];

  return (
    <Section
      title="Automatische Anpassungen"
      icon={<Sparkles className="h-4 w-4" />}
    >
      {q.isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Keine automatischen Ernährungsanpassungen in den letzten Einträgen.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">
                  {fmtDate(r.date)} · {REASON_LABELS[r.reason] ?? r.reason}
                </div>
                <div className="text-muted-foreground">
                  {r.meal_count != null
                    ? `${r.meal_count} Mahlzeit${r.meal_count === 1 ? "" : "en"} angepasst`
                    : "Anpassung protokolliert"}
                </div>
              </div>
              <div className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                {fmtTime(r.created_at)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

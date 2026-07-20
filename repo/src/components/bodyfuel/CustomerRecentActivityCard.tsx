import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerRecentActivity } from "@/lib/coaching.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

function formatDayLabel(dateStr: string, index: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  const fmt = date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  if (index === 0) return `Heute · ${fmt}`;
  if (index === 1) return `Gestern · ${fmt}`;
  if (index === 2) return `Vorgestern · ${fmt}`;
  return fmt;
}

export function CustomerRecentActivityCard({ userId }: { userId: string }) {
  const getFn = useServerFn(getCustomerRecentActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-recent-activity", userId],
    queryFn: () => getFn({ data: { user_id: userId, days: 3 } }),
  });

  const [selected, setSelected] = useState<string>("");

  const days = data?.days ?? [];
  const activeDate = selected || days[0]?.date || "";
  const activeIdx = days.findIndex((d) => d.date === activeDate);
  const day = days[activeIdx] ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Aktivität (letzte 3 Tage)</h2>
        <Select value={activeDate} onValueChange={setSelected}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Tag wählen" />
          </SelectTrigger>
          <SelectContent>
            {days.map((d, i) => (
              <SelectItem key={d.date} value={d.date}>
                {formatDayLabel(d.date, i)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Lade…</p>
      )}

      {!isLoading && day && (
        <div className="mt-6 space-y-6">
          {/* Tagespunkte */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tagespunkte
            </h3>
            {day.check ? (
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-gold">
                  {day.check.points}
                </span>
                <span className="text-xs text-muted-foreground">
                  {Object.values(day.check.tasks ?? {}).filter(Boolean).length} Aufgaben erledigt
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Kein Check-in.</p>
            )}
          </section>

          {/* Ernährung */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ernährung
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="kcal" value={Math.round(day.nutrition.totals.kcal)} />
              <Metric label="Protein" value={`${Math.round(day.nutrition.totals.protein_g)} g`} />
              <Metric label="Carbs" value={`${Math.round(day.nutrition.totals.carbs_g)} g`} />
              <Metric label="Fett" value={`${Math.round(day.nutrition.totals.fat_g)} g`} />
            </div>
            {day.nutrition.entries.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Keine Einträge.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-secondary/30 text-sm">
                {day.nutrition.entries.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.name}</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {MEAL_LABEL[e.meal] ?? e.meal} · {Math.round(e.serving_g)} g
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        {Math.round(e.kcal)} kcal
                      </div>
                      <div>
                        P {Math.round(e.protein_g)} · K {Math.round(e.carbs_g)} · F {Math.round(e.fat_g)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Training */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Training
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Sätze" value={day.training.total_sets} />
              <Metric label="Volumen" value={`${day.training.total_volume} kg`} />
              <Metric label="Übungen" value={day.training.exercises.length} />
            </div>
            {day.training.exercises.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Kein Training.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {day.training.exercises.map((ex, i) => (
                  <li key={i} className="rounded-xl border border-border bg-secondary/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{ex.name}</span>
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {ex.total_sets} Sätze · {ex.volume} kg
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ex.sets.map((s, j) => (
                        <span
                          key={j}
                          className="rounded-md bg-background px-2 py-0.5 text-xs"
                        >
                          {s.weight_kg ?? "—"} kg × {s.reps ?? "—"}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

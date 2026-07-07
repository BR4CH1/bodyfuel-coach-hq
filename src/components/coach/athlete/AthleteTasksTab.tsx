import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { Section, TinyStat } from "./athlete-tab-shared";

type Filter = "all" | "open" | "done" | "missed";

export function AthleteTasksTab({ data }: { data: CoachAthleteDetail }) {
  const [filter, setFilter] = useState<Filter>("all");
  const t = data.training;

  const filtered = useMemo(() => {
    if (filter === "all") return t.timeline;
    return t.timeline.filter((i) => i.status === filter);
  }, [t.timeline, filter]);

  return (
    <div className="space-y-4">
      <Section title="Aufgaben · letzte 30 Tage" icon={<ListChecks className="h-4 w-4" />}>
        <div className="grid grid-cols-4 gap-2">
          <TinyStat label="Zugewiesen" value={t.assigned} />
          <TinyStat label="Abgeschl." value={t.done} tone="green" />
          <TinyStat label="Offen" value={t.open} tone="yellow" />
          <TinyStat label="Ausgel." value={t.missed} tone="red" />
        </div>
      </Section>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "Alle"],
            ["open", "Offen"],
            ["done", "Erledigt"],
            ["missed", "Ausgelassen"],
          ] as Array<[Filter, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              filter === k
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Keine Aufgaben in diesem Filter.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((item) => {
            const dateStr = new Date(item.date).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            });
            const statusLabel =
              item.status === "done"
                ? "Erledigt"
                : item.status === "missed"
                ? "Überfällig"
                : item.status === "open"
                ? "Offen"
                : "—";
            const statusCls =
              item.status === "done"
                ? "text-green-500"
                : item.status === "missed"
                ? "text-red-500"
                : "text-yellow-600";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground">Fällig: {dateStr}</div>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${statusCls}`}>
                  {statusLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
        Aufgaben-Editor (Erstellen · Bearbeiten · Frist ändern) folgt im nächsten Schritt.
      </div>
    </div>
  );
}

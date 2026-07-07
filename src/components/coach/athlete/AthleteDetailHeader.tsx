import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { Initials, STATUS_TONE } from "./athlete-tab-shared";

export function AthleteDetailHeader({ data }: { data: CoachAthleteDetail }) {
  const a = data.athlete;
  const jersey = a.jersey_number != null ? `#${a.jersey_number}` : null;
  const pos = [a.position, a.secondary_position].filter(Boolean).join(" · ");
  const base: string[] = [];
  if (a.age != null) base.push(`${a.age} Jahre`);
  if (a.height_cm != null) base.push(`${a.height_cm} cm`);
  if (a.current_weight_kg != null) base.push(`${a.current_weight_kg.toFixed(1)} kg`);
  return (
    <section>
      <div className="flex items-start gap-3">
        <Initials name={a.display_name} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">
            {a.display_name}
          </h1>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {[a.team_name, pos || null, jersey].filter(Boolean).join(" · ") || "—"}
          </div>
          {base.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {base.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
            STATUS_TONE[data.status.key]
          }`}
        >
          {data.status.label}
        </span>
      </div>
    </section>
  );
}

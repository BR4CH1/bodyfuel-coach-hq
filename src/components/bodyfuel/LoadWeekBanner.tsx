import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import {
  LOAD_LEVELS,
  listLoadWeek,
  type LoadDay,
} from "@/lib/organizations/load-management.functions";

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date): Date {
  const c = new Date(d);
  const dow = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - dow);
  c.setHours(0, 0, 0, 0);
  return c;
}

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Read-only Athleten-Banner. Zeigt die Belastungswoche des Coaches.
 * Wählt team-spezifische Einträge, fällt auf orgweite Einträge zurück.
 */
export function LoadWeekBanner({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string | null;
}) {
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const listFn = useServerFn(listLoadWeek);

  // Team-spezifisch
  const teamQ = useQuery({
    queryKey: ["athlete-load-week-team", orgId, teamId, isoDate(weekStart)],
    enabled: !!teamId,
    queryFn: () =>
      listFn({
        data: {
          orgId,
          teamId,
          weekStart: isoDate(weekStart),
          weekEnd: isoDate(weekEnd),
        },
      }),
  });

  // Orgweit
  const orgQ = useQuery({
    queryKey: ["athlete-load-week-org", orgId, isoDate(weekStart)],
    queryFn: () =>
      listFn({
        data: {
          orgId,
          teamId: null,
          weekStart: isoDate(weekStart),
          weekEnd: isoDate(weekEnd),
        },
      }),
  });

  const teamRows = (teamQ.data ?? []) as LoadDay[];
  const orgRows = (orgQ.data ?? []) as LoadDay[];

  const byDate = useMemo(() => {
    const m = new Map<string, LoadDay>();
    // orgweit als Fallback zuerst, dann team überschreiben
    orgRows.forEach((r) => m.set(r.date, r));
    teamRows.forEach((r) => m.set(r.date, r));
    return m;
  }, [teamRows, orgRows]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  const todayIso = isoDate(new Date());
  const todayRow = byDate.get(todayIso);
  const anyData = byDate.size > 0;
  if (!anyData) return null;

  return (
    <div className="mx-5 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-bulls-red" />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Belastung diese Woche
        </div>
      </div>

      {todayRow && (
        <div className="mb-3 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Heute
            </div>
            <div
              className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: LOAD_LEVELS[todayRow.load_level].color }}
            >
              {LOAD_LEVELS[todayRow.load_level].label}
            </div>
          </div>
          {todayRow.session_type && (
            <div className="mt-1 text-sm font-semibold">{todayRow.session_type}</div>
          )}
          {todayRow.notes && (
            <div className="mt-1 text-xs text-muted-foreground">{todayRow.notes}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const iso = isoDate(d);
          const r = byDate.get(iso);
          const isToday = iso === todayIso;
          return (
            <div key={iso} className="flex flex-col items-center gap-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {DAY_LABELS[i]}
              </div>
              <div
                className={`grid h-8 w-8 place-items-center rounded-md text-[10px] font-bold text-white ${
                  isToday ? "ring-2 ring-offset-1 ring-offset-background" : ""
                }`}
                style={{
                  background: r ? LOAD_LEVELS[r.load_level].color : "#1f1f1f",
                  opacity: r ? 1 : 0.4,
                }}
                title={r ? LOAD_LEVELS[r.load_level].label : "—"}
              >
                {r ? LOAD_LEVELS[r.load_level].short : "·"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

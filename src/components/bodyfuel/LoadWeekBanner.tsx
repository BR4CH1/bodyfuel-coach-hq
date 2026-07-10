import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, PencilLine, RotateCcw } from "lucide-react";
import {
  LOAD_LEVELS,
  listLoadWeek,
  getLoadForAthlete,
  upsertAthleteLoadOverride,
  clearAthleteLoadOverride,
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
 * Read-only Athleten-Banner. Zeigt die Belastungswoche des Coaches und
 * erlaubt dem Athleten, den heutigen Tag für sich selbst zu überschreiben
 * (z. B. krank, Reise, Reha). Der Override wirkt auf die Ernährungs-Engine
 * (Day-Type-Resolver) und schlägt den Coach-Wert.
 */
export function LoadWeekBanner({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string | null;
}) {
  const qc = useQueryClient();
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const todayIso = isoDate(new Date());

  const listFn = useServerFn(listLoadWeek);
  const getForMeFn = useServerFn(getLoadForAthlete);
  const upsertOverrideFn = useServerFn(upsertAthleteLoadOverride);
  const clearOverrideFn = useServerFn(clearAthleteLoadOverride);

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

  // Effektiver Wert für heute inkl. Override.
  const todayQ = useQuery({
    queryKey: ["athlete-load-today", orgId, teamId, todayIso],
    queryFn: () => getForMeFn({ data: { orgId, teamId, date: todayIso } }),
  });

  const teamRows = (teamQ.data ?? []) as LoadDay[];
  const orgRows = (orgQ.data ?? []) as LoadDay[];

  const byDate = useMemo(() => {
    const m = new Map<string, LoadDay>();
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

  const todayEff = todayQ.data as
    | (LoadDay & { source: "athlete_override" | "team" | "org" })
    | null
    | undefined;
  const todayCoach = byDate.get(todayIso);
  const isOverridden = todayEff?.source === "athlete_override";

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["athlete-load-today", orgId] });
    // Auch Nutrition-Ableitungen bitte neu ziehen — best-effort.
    qc.invalidateQueries({ queryKey: ["bulls-daily-nutrition-targets"] });
    qc.invalidateQueries({ queryKey: ["performance-day-type"] });
    qc.invalidateQueries({ queryKey: ["nutrition-target"] });
  };

  const applyOverride = async (level: number) => {
    setBusy(true);
    try {
      await upsertOverrideFn({
        data: { orgId, date: todayIso, load_level: level },
      });
      invalidateAll();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async () => {
    setBusy(true);
    try {
      await clearOverrideFn({ data: { orgId, date: todayIso } });
      invalidateAll();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const anyData = byDate.size > 0 || !!todayEff;
  if (!anyData) return null;

  const todayRow = todayEff ?? todayCoach ?? null;

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
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Heute
              </div>
              {isOverridden && (
                <div className="rounded-md bg-bulls-red/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-bulls-red">
                  Eigene Anpassung
                </div>
              )}
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

          {!editing ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <PencilLine className="h-3 w-3" />
                Fühle mich anders
              </button>
              {isOverridden && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={removeOverride}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Coach-Vorgabe
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Deine tatsächliche Belastung
              </div>
              <div className="flex flex-wrap gap-1">
                {LOAD_LEVELS.map((lvl) => (
                  <button
                    key={lvl.level}
                    type="button"
                    disabled={busy}
                    onClick={() => applyOverride(lvl.level)}
                    className="rounded-md px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                    style={{ background: lvl.color }}
                  >
                    {lvl.short} · {lvl.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const iso = isoDate(d);
          const r = byDate.get(iso);
          const isToday = iso === todayIso;
          // Für heute effektive Anzeige (inkl. Override), sonst Coach-Wert.
          const effLevel =
            isToday && todayEff ? todayEff.load_level : r?.load_level;
          const overriddenHere = isToday && isOverridden;
          return (
            <div key={iso} className="flex flex-col items-center gap-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {DAY_LABELS[i]}
              </div>
              <div
                className={`grid h-8 w-8 place-items-center rounded-md text-[10px] font-bold text-white ${
                  isToday ? "ring-2 ring-offset-1 ring-offset-background" : ""
                } ${overriddenHere ? "outline outline-1 outline-bulls-red" : ""}`}
                style={{
                  background:
                    typeof effLevel === "number"
                      ? LOAD_LEVELS[effLevel].color
                      : "#1f1f1f",
                  opacity: typeof effLevel === "number" ? 1 : 0.4,
                }}
                title={
                  typeof effLevel === "number"
                    ? LOAD_LEVELS[effLevel].label
                    : "—"
                }
              >
                {typeof effLevel === "number" ? LOAD_LEVELS[effLevel].short : "·"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

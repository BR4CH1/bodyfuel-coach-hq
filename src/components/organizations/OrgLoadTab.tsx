import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Gauge, Sparkles, X } from "lucide-react";
import {
  LOAD_LEVELS,
  listLoadWeek,
  upsertLoadDay,
  type LoadDay,
} from "@/lib/organizations/load-management.functions";
import {
  suggestLoadWeek,
  type LoadSuggestion,
  type LoadSuggestionDay,
} from "@/lib/organizations/load-analysis.functions";

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // Monday=0
  copy.setDate(copy.getDate() - dow);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function OrgLoadTab({
  orgId,
  teams,
  canManage,
}: {
  orgId: string;
  teams: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [teamId, setTeamId] = useState<string | null>(null);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  const listFn = useServerFn(listLoadWeek);
  const upsertFn = useServerFn(upsertLoadDay);
  const qc = useQueryClient();

  const queryKey = [
    "org-load-week",
    orgId,
    teamId ?? "org",
    isoDate(weekStart),
  ];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
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

  const rowsList = rows as LoadDay[];
  const byDate = useMemo(() => {
    const m = new Map<string, LoadDay>();
    rowsList.forEach((r) => m.set(r.date, r));
    return m;
  }, [rowsList]);

  const upsert = useMutation({
    mutationFn: (input: {
      date: string;
      load_level: number;
      session_type?: string | null;
      notes?: string | null;
    }) =>
      upsertFn({
        data: {
          orgId,
          teamId,
          date: input.date,
          load_level: input.load_level,
          session_type: input.session_type,
          notes: input.notes,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-bulls-red" />
          Belastungssteuerung
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Gib pro Tag die geplante sportliche Belastung vor. BodyFuel nutzt die
          Werte zur Ernährungssteuerung — unabhängig davon, ob Smart Training
          aktiv ist. Athleten sehen die Woche in ihrem Vereins-Home.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shiftWeek(-1)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:border-bulls-red/60"
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          {weekStart.toLocaleDateString("de-DE")} – {weekEnd.toLocaleDateString("de-DE")}
        </div>
        <button
          onClick={() => shiftWeek(1)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:border-bulls-red/60"
          aria-label="Nächste Woche"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:border-bulls-red/60"
        >
          Heute
        </button>

        {teams.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button
              onClick={() => setTeamId(null)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                teamId === null
                  ? "border-bulls-red bg-bulls-red/10 text-bulls-red"
                  : "border-border bg-card"
              }`}
            >
              Orgweit
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  teamId === t.id
                    ? "border-bulls-red bg-bulls-red/10 text-bulls-red"
                    : "border-border bg-card"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lädt…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {days.map((d, i) => {
            const dateIso = isoDate(d);
            const row = byDate.get(dateIso);
            return (
              <DayCard
                key={dateIso}
                label={DAY_LABELS[i]}
                date={d}
                row={row}
                canManage={canManage}
                onLevel={(level) =>
                  upsert.mutate({
                    date: dateIso,
                    load_level: level,
                    session_type: row?.session_type ?? null,
                    notes: row?.notes ?? null,
                  })
                }
                onSaveText={(session_type, notes) =>
                  upsert.mutate({
                    date: dateIso,
                    load_level: row?.load_level ?? 0,
                    session_type,
                    notes,
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayCard({
  label,
  date,
  row,
  canManage,
  onLevel,
  onSaveText,
}: {
  label: string;
  date: Date;
  row: LoadDay | undefined;
  canManage: boolean;
  onLevel: (level: number) => void;
  onSaveText: (session: string | null, notes: string | null) => void;
}) {
  const [session, setSession] = useState(row?.session_type ?? "");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const level = row?.load_level ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-semibold">
            {date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
          </div>
        </div>
        {level != null && (
          <div
            className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ background: LOAD_LEVELS[level].color }}
          >
            {LOAD_LEVELS[level].label}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {LOAD_LEVELS.map((l) => (
          <button
            key={l.level}
            disabled={!canManage}
            onClick={() => onLevel(l.level)}
            className={`h-8 w-8 rounded-md text-xs font-bold text-white transition ${
              level === l.level ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"
            } ${!canManage ? "cursor-not-allowed" : ""}`}
            style={{ background: l.color }}
            title={l.label}
          >
            {l.short}
          </button>
        ))}
      </div>

      <input
        value={session}
        onChange={(e) => setSession(e.target.value)}
        onBlur={() => {
          const s = session.trim() || null;
          if (s !== (row?.session_type ?? null)) onSaveText(s, notes.trim() || null);
        }}
        disabled={!canManage}
        placeholder="Session-Typ (z. B. Kraft, Ausdauer)"
        className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          const n = notes.trim() || null;
          if (n !== (row?.notes ?? null)) onSaveText(session.trim() || null, n);
        }}
        disabled={!canManage}
        placeholder="Notiz für Athleten"
        rows={2}
        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
}

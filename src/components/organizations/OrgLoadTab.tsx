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

  const [smartOpen, setSmartOpen] = useState(false);
  const suggestFn = useServerFn(suggestLoadWeek);
  const [suggestion, setSuggestion] = useState<LoadSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [applying, setApplying] = useState(false);

  const applySuggestion = async (sugg: LoadSuggestion) => {
    setApplying(true);
    try {
      for (const d of sugg.days) {
        await upsertFn({
          data: {
            orgId,
            teamId,
            date: d.date,
            load_level: d.load_level,
            session_type: d.session_type,
            notes: d.notes,
          },
        });
      }
      await qc.invalidateQueries({ queryKey });
      setSmartOpen(false);
      setSuggestion(null);
    } finally {
      setApplying(false);
    }
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
        {canManage && (
          <button
            onClick={() => {
              setSuggestion(null);
              setSmartOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bulls-red/60 bg-bulls-red/10 px-3 py-1.5 text-xs font-semibold text-bulls-red hover:bg-bulls-red/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Smart-Vorschlag
          </button>
        )}

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

      {smartOpen && (
        <SmartSuggestModal
          weekStart={isoDate(weekStart)}
          weekLabel={`${weekStart.toLocaleDateString("de-DE")} – ${weekEnd.toLocaleDateString("de-DE")}`}
          days={days}
          suggestion={suggestion}
          suggesting={suggesting}
          applying={applying}
          onClose={() => {
            setSmartOpen(false);
            setSuggestion(null);
          }}
          onSuggest={async (matchDates, notes, mode) => {
            setSuggesting(true);
            try {
              const res = await suggestFn({
                data: {
                  orgId,
                  teamId,
                  weekStart: isoDate(weekStart),
                  matchDates,
                  notes,
                  mode,
                },
              });
              setSuggestion(res as LoadSuggestion);
            } finally {
              setSuggesting(false);
            }
          }}
          onApply={applySuggestion}
        />
      )}
    </div>
  );
}

function SmartSuggestModal({
  weekLabel,
  days,
  suggestion,
  suggesting,
  applying,
  onClose,
  onSuggest,
  onApply,
}: {
  weekStart: string;
  weekLabel: string;
  days: Date[];
  suggestion: LoadSuggestion | null;
  suggesting: boolean;
  applying: boolean;
  onClose: () => void;
  onSuggest: (matchDates: string[], notes: string | null, mode: "auto" | "heuristic" | "ai") => Promise<void>;
  onApply: (sugg: LoadSuggestion) => Promise<void>;
}) {
  const [matches, setMatches] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"auto" | "heuristic" | "ai">("auto");

  const toggleMatch = (iso: string) =>
    setMatches((m) => ({ ...m, [iso]: !m[iso] }));

  const selectedMatches = Object.entries(matches)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-bulls-red" />
            Smart-Belastungsvorschlag
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Woche
            </div>
            <div className="text-sm font-semibold">{weekLabel}</div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spieltage in der Woche
            </div>
            <div className="flex flex-wrap gap-1.5">
              {days.map((d, i) => {
                const iso = (() => {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                })();
                const on = !!matches[iso];
                return (
                  <button
                    key={iso}
                    onClick={() => toggleMatch(iso)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                      on
                        ? "border-bulls-red bg-bulls-red/10 text-bulls-red"
                        : "border-border bg-background"
                    }`}
                  >
                    {DAY_LABELS[i]} {d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Wenn Spieltage gesetzt sind, wird ein MD-Zyklus gerechnet — sonst schlägt die KI eine sinnvolle Trainingswoche vor.
            </p>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kontext / Coach-Notiz (optional)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="z. B. „Testspiel am Donnerstag, Regenerationswoche"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["auto", "heuristic", "ai"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  mode === m
                    ? "border-bulls-red bg-bulls-red/10 text-bulls-red"
                    : "border-border bg-background"
                }`}
              >
                {m === "auto" ? "Auto" : m === "heuristic" ? "Heuristik" : "KI"}
              </button>
            ))}
            <button
              onClick={() => onSuggest(selectedMatches, notes.trim() || null, mode)}
              disabled={suggesting}
              className="ml-auto rounded-lg bg-bulls-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-bulls-red/90 disabled:opacity-60"
            >
              {suggesting ? "Berechne…" : "Vorschlag erzeugen"}
            </button>
          </div>

          {suggestion && (
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vorschlag ({suggestion.source === "ai" ? "KI" : "Heuristik"})
                </div>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{suggestion.reasoning}</p>
              <div className="space-y-1.5">
                {suggestion.days.map((d: LoadSuggestionDay, i: number) => (
                  <div key={d.date} className="flex items-center gap-2 text-xs">
                    <div className="w-8 font-bold text-muted-foreground">{DAY_LABELS[i]}</div>
                    <div
                      className="rounded-md px-2 py-0.5 font-bold text-white"
                      style={{ background: LOAD_LEVELS[d.load_level].color }}
                    >
                      {LOAD_LEVELS[d.load_level].short}
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold">{d.session_type ?? "—"}</span>
                      {d.notes && <span className="text-muted-foreground"> · {d.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
          >
            Abbrechen
          </button>
          <button
            onClick={() => suggestion && onApply(suggestion)}
            disabled={!suggestion || applying}
            className="rounded-lg bg-bulls-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-bulls-red/90 disabled:opacity-60"
          >
            {applying ? "Übernehme…" : "Woche übernehmen"}
          </button>
        </div>
      </div>
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

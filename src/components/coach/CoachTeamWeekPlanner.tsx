import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  getTeamTrainingWeek,
  upsertTeamTrainingWeek,
  publishTeamTrainingWeek,
  toMondayIso,
} from "@/lib/organizations/team-training-week.functions";

const WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
function isoWeekNumber(dateIso: string): number {
  const d = new Date(dateIso + "T12:00:00Z");
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}
function formatDateShort(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

type EditorSession = {
  session_date: string;
  title: string;
  start_time: string;
  end_time: string;
  active: boolean;
};

export function CoachTeamWeekPlanner({
  orgId,
  teamId,
  teamName,
}: {
  orgId: string;
  teamId: string;
  teamName: string;
}) {
  const qc = useQueryClient();
  const today = isoDate(new Date());
  const currentMonday = toMondayIso(today);

  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const weekEnd = addDaysIso(weekStart, 6);
  const weekNr = isoWeekNumber(weekStart);
  const isPast = weekEnd < today;
  const isCurrent = weekStart === currentMonday;

  const getWeek = useServerFn(getTeamTrainingWeek);
  const saveDraft = useServerFn(upsertTeamTrainingWeek);
  const publish = useServerFn(publishTeamTrainingWeek);

  const q = useQuery({
    queryKey: ["team-training-week", orgId, teamId, weekStart],
    queryFn: () => getWeek({ data: { organization_id: orgId, team_id: teamId, week_start: weekStart } }),
  });

  const initialSessions = useMemo<EditorSession[]>(() => {
    const map = new Map<string, EditorSession>();
    for (const s of (q.data?.sessions ?? []) as any[]) {
      map.set(s.session_date, {
        session_date: s.session_date,
        title: s.title || "Team Training",
        start_time: (s.start_time ?? "").slice(0, 5),
        end_time: (s.end_time ?? "").slice(0, 5),
        active: s.active !== false,
      });
    }
    return WEEKDAYS_DE.map((_, i) => {
      const date = addDaysIso(weekStart, i);
      return (
        map.get(date) ?? {
          session_date: date,
          title: "Team Training",
          start_time: "",
          end_time: "",
          active: false,
        }
      );
    });
  }, [q.data, weekStart]);

  const [sessions, setSessions] = useState<EditorSession[]>(initialSessions);
  const [lastKey, setLastKey] = useState<string>("");
  const key = `${weekStart}::${(q.data?.sessions ?? [])
    .map((s: any) => `${s.session_date}:${s.title}:${s.start_time}:${s.end_time}:${s.active}`)
    .join("|")}`;
  if (key !== lastKey) {
    setLastKey(key);
    setSessions(initialSessions);
  }

  const patch = (i: number, p: Partial<EditorSession>) =>
    setSessions((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const saveMut = useMutation({
    mutationFn: async () => {
      const active = sessions.filter((s) => s.active);
      return saveDraft({
        data: {
          organization_id: orgId,
          team_id: teamId,
          week_start: weekStart,
          sessions: active.map((s) => ({
            session_date: s.session_date,
            title: s.title || "Team Training",
            start_time: s.start_time || null,
            end_time: s.end_time || null,
            active: true,
          })),
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["team-training-week", orgId, teamId, weekStart] });
      toast.success("Als Entwurf gespeichert.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen."),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      // Erst Draft speichern, dann publish.
      const active = sessions.filter((s) => s.active);
      await saveDraft({
        data: {
          organization_id: orgId,
          team_id: teamId,
          week_start: weekStart,
          sessions: active.map((s) => ({
            session_date: s.session_date,
            title: s.title || "Team Training",
            start_time: s.start_time || null,
            end_time: s.end_time || null,
            active: true,
          })),
        },
      });
      return publish({
        data: { organization_id: orgId, team_id: teamId, week_start: weekStart },
      });
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["team-training-week", orgId, teamId, weekStart] });
      toast.success(
        `Wochenplan veröffentlicht — jetzt für ${r.published_for_athletes} Athlet:innen verfügbar.`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Veröffentlichen fehlgeschlagen."),
  });

  const status = q.data?.status ?? "draft";
  const wasPublished = status === "published";
  const anyActive = sessions.some((s) => s.active);

  const goto = (delta: number) => setWeekStart((w) => addDaysIso(w, delta));

  const statusBadge = (() => {
    if (isCurrent) return { text: "Aktuelle Woche", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" };
    if (isPast) return { text: "Vergangen", cls: "bg-neutral-800 text-neutral-500 border-neutral-700" };
    if (wasPublished) return { text: "Veröffentlicht", cls: "bg-bulls-red/15 text-bulls-red border-bulls-red/40" };
    return { text: "Entwurf", cls: "bg-amber-500/15 text-amber-400 border-amber-500/40" };
  })();

  return (
    <div className="rounded-2xl border border-[#252525] bg-[#0f0f0f] p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-bulls-red">
            <CalendarDays className="h-3.5 w-3.5" />
            Team Training · {teamName}
          </div>
          <h3 className="mt-1 font-display text-xl font-bold text-white">
            KW {weekNr} · {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
          </h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusBadge.cls}`}>
          {statusBadge.text}
        </span>
      </div>

      {/* Navigation */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => goto(-7)}
          className="flex items-center gap-1 rounded-lg border border-[#252525] bg-[#111] px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-bulls-red/60 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Vorherige
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(currentMonday)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            isCurrent
              ? "border-bulls-red bg-bulls-red/15 text-white"
              : "border-[#252525] bg-[#111] text-neutral-300 hover:text-white"
          }`}
        >
          Aktuelle
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(addDaysIso(currentMonday, 7))}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            weekStart === addDaysIso(currentMonday, 7)
              ? "border-bulls-red bg-bulls-red/15 text-white"
              : "border-[#252525] bg-[#111] text-neutral-300 hover:text-white"
          }`}
        >
          Nächste
        </button>
        <button
          type="button"
          onClick={() => goto(7)}
          className="flex items-center gap-1 rounded-lg border border-[#252525] bg-[#111] px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-bulls-red/60 hover:text-white"
        >
          Nächste Woche <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sessions */}
      <div className="mt-4 divide-y divide-[#1a1a1a] rounded-xl border border-[#252525] bg-[#111]">
        {sessions.map((s, i) => (
          <div key={s.session_date} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-white">
                  {WEEKDAYS_DE[i]}{" "}
                  <span className="text-[10px] font-normal uppercase tracking-wider text-neutral-500">
                    · {formatDateShort(s.session_date)}
                  </span>
                </div>
              </div>
              {s.active ? (
                <button
                  type="button"
                  onClick={() => patch(i, { active: false })}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400"
                >
                  Aktiv <Trash2 className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    patch(i, { active: true, title: s.title || "Team Training" })
                  }
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[#252525] bg-[#0f0f0f] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:border-bulls-red/60 hover:text-bulls-red"
                >
                  <Plus className="h-3 w-3" /> Training hinzufügen
                </button>
              )}
            </div>
            {s.active && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  value={s.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder="Team Training"
                  className="rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white placeholder:text-neutral-600"
                />
                <input
                  type="time"
                  value={s.start_time}
                  onChange={(e) => patch(i, { start_time: e.target.value })}
                  className="rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
                />
                <input
                  type="time"
                  value={s.end_time}
                  onChange={(e) => patch(i, { end_time: e.target.value })}
                  className="rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={saveMut.isPending || publishMut.isPending}
          onClick={() => saveMut.mutate()}
          className="rounded-lg border border-[#252525] bg-[#111] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-white disabled:opacity-50"
        >
          {saveMut.isPending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Als Entwurf speichern
        </button>
        <button
          type="button"
          disabled={publishMut.isPending || !anyActive}
          onClick={() => publishMut.mutate()}
          className="flex items-center justify-center gap-2 rounded-lg bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)] hover:brightness-110 disabled:opacity-50"
        >
          {publishMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {wasPublished ? "Änderungen veröffentlichen" : `Plan für ${formatDateShort(weekStart)}–${formatDateShort(weekEnd)} veröffentlichen`}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Der Plan gilt nur für die gewählte Woche. Andere Wochen und bereits absolvierte
        Einheiten bleiben unverändert.
      </p>
    </div>
  );
}

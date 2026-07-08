import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  CalendarDays,
  Bookmark,
  BookmarkPlus,
  Sparkles,
  Eye,
  Pencil,
  Copy,
  X,
  CalendarPlus,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTeamTrainingWeek,
  upsertTeamTrainingWeek,
  publishTeamTrainingWeek,
} from "@/lib/organizations/team-training-week.functions";
import {
  listTrainingTemplates,
  createTrainingTemplate,
  updateTrainingTemplate,
  duplicateTrainingTemplate,
  deleteTrainingTemplate,
} from "@/lib/organizations/training-templates.functions";
import {
  listWeekTemplates,
  createWeekTemplate,
  deleteWeekTemplate,
  type WeekTemplateSession,
} from "@/lib/organizations/training-week-templates.functions";
import {
  detectTrainingFocus,
  FOCUS_LABEL,
  FOCUS_CHOICES,
  focusTriggersAthleteSession,
  type TrainingFocus,
} from "@/lib/training-focus-detection";
import { previewAthleteSession } from "@/lib/organizations/athlete-training-session-pool";

function toMondayIso(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00Z");
  const dow = d.getUTCDay();
  const offset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

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
  description: string;
  start_time: string;
  end_time: string;
  active: boolean;
  focus: TrainingFocus | null;
  focus_source: "auto" | "manual" | "none" | null;
};

type Template = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  focus: TrainingFocus;
  duration_min: number | null;
  start_time: string | null;
  end_time: string | null;
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
  const listTpls = useServerFn(listTrainingTemplates);
  const createTpl = useServerFn(createTrainingTemplate);

  const q = useQuery({
    queryKey: ["team-training-week", orgId, teamId, weekStart],
    queryFn: () => getWeek({ data: { organization_id: orgId, team_id: teamId, week_start: weekStart } }),
  });

  const templatesQ = useQuery({
    queryKey: ["training-templates", orgId],
    queryFn: () => listTpls({ data: { organization_id: orgId } }),
  });
  const templates = (templatesQ.data ?? []) as Template[];

  const initialSessions = useMemo<EditorSession[]>(() => {
    const map = new Map<string, EditorSession>();
    for (const s of (q.data?.sessions ?? []) as any[]) {
      map.set(s.session_date, {
        session_date: s.session_date,
        title: s.title || "Team Training",
        description: s.description ?? "",
        start_time: (s.start_time ?? "").slice(0, 5),
        end_time: (s.end_time ?? "").slice(0, 5),
        active: s.active !== false,
        focus: (s.focus as TrainingFocus) ?? null,
        focus_source: (s.focus_source as any) ?? null,
      });
    }
    return WEEKDAYS_DE.map((_, i) => {
      const date = addDaysIso(weekStart, i);
      return (
        map.get(date) ?? {
          session_date: date,
          title: "Team Training",
          description: "",
          start_time: "",
          end_time: "",
          active: false,
          focus: null as TrainingFocus | null,
          focus_source: null,
        }
      );
    });
  }, [q.data, weekStart]);

  const [sessions, setSessions] = useState<EditorSession[]>(initialSessions);
  const [lastKey, setLastKey] = useState<string>("");
  const key = `${weekStart}::${(q.data?.sessions ?? [])
    .map(
      (s: any) =>
        `${s.session_date}:${s.title}:${s.description ?? ""}:${s.start_time}:${s.end_time}:${s.active}:${s.focus ?? ""}:${s.focus_source ?? ""}`,
    )
    .join("|")}`;
  if (key !== lastKey) {
    setLastKey(key);
    setSessions(initialSessions);
  }

  // Fokus je Session auto-berechnen wenn nicht manuell überschrieben
  const enrichedSessions = useMemo(
    () =>
      sessions.map((s) => {
        if (s.focus_source === "manual") return s;
        if (!s.active) return s;
        const det = detectTrainingFocus(s.title, s.description);
        return { ...s, focus: det.focus, focus_source: "auto" as const };
      }),
    [sessions],
  );

  const patch = (i: number, p: Partial<EditorSession>) =>
    setSessions((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const saveMut = useMutation({
    mutationFn: async () => {
      const active = enrichedSessions.filter((s) => s.active);
      return saveDraft({
        data: {
          organization_id: orgId,
          team_id: teamId,
          week_start: weekStart,
          sessions: active.map((s) => ({
            session_date: s.session_date,
            title: s.title || "Team Training",
            description: s.description || null,
            start_time: s.start_time || null,
            end_time: s.end_time || null,
            active: true,
            focus: s.focus,
            focus_source: s.focus_source,
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
      const active = enrichedSessions.filter((s) => s.active);
      await saveDraft({
        data: {
          organization_id: orgId,
          team_id: teamId,
          week_start: weekStart,
          sessions: active.map((s) => ({
            session_date: s.session_date,
            title: s.title || "Team Training",
            description: s.description || null,
            start_time: s.start_time || null,
            end_time: s.end_time || null,
            active: true,
            focus: s.focus,
            focus_source: s.focus_source,
          })),
        },
      });
      return publish({
        data: { organization_id: orgId, team_id: teamId, week_start: weekStart },
      });
    },
    onSuccess: async (r: any) => {
      await qc.invalidateQueries({ queryKey: ["team-training-week", orgId, teamId, weekStart] });
      const ath = r?.athletic_sessions;
      const suffix =
        ath && (ath.inserted + ath.updated) > 0
          ? ` · ${ath.inserted + ath.updated} Athletik-Sessions generiert`
          : "";
      toast.success(
        `Wochenplan veröffentlicht — für ${r.published_for_athletes} Athlet:innen${suffix}.`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Veröffentlichen fehlgeschlagen."),
  });

  const saveTemplateMut = useMutation({
    mutationFn: async (args: { name: string; s: EditorSession }) => {
      const focus = args.s.focus ?? "none";
      const durationMin =
        args.s.start_time && args.s.end_time
          ? Math.max(
              15,
              Math.round(
                (parseInt(args.s.end_time.split(":")[0] || "0") * 60 +
                  parseInt(args.s.end_time.split(":")[1] || "0") -
                  (parseInt(args.s.start_time.split(":")[0] || "0") * 60 +
                    parseInt(args.s.start_time.split(":")[1] || "0"))) || 45,
              ),
            )
          : null;
      return createTpl({
        data: {
          organization_id: orgId,
          name: args.name,
          title: args.s.title || "Team Training",
          description: args.s.description || null,
          focus,
          duration_min: durationMin,
          start_time: args.s.start_time || null,
          end_time: args.s.end_time || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-templates", orgId] });
      toast.success("Vorlage gespeichert.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern der Vorlage."),
  });

  const applyTemplate = (idx: number, tpl: Template) => {
    patch(idx, {
      active: true,
      title: tpl.title,
      description: tpl.description ?? "",
      start_time: (tpl.start_time ?? "").slice(0, 5),
      end_time: (tpl.end_time ?? "").slice(0, 5),
      focus: tpl.focus,
      focus_source: tpl.focus === "none" ? "none" : "manual",
    });
    toast.success(`Vorlage „${tpl.name}" übernommen.`);
  };

  const [templatePickerFor, setTemplatePickerFor] = useState<number | null>(null);
  const [saveTemplateFor, setSaveTemplateFor] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [previewSession, setPreviewSession] = useState<EditorSession | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const status = q.data?.status ?? "draft";
  const wasPublished = status === "published";
  const anyActive = enrichedSessions.some((s) => s.active);

  const goto = (delta: number) => setWeekStart((w) => addDaysIso(w, delta));

  const statusBadge = (() => {
    if (isCurrent) return { text: "Aktuelle Woche", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" };
    if (isPast) return { text: "Vergangen", cls: "bg-neutral-800 text-neutral-500 border-neutral-700" };
    if (wasPublished) return { text: "Veröffentlicht", cls: "bg-bulls-red/15 text-bulls-red border-bulls-red/40" };
    return { text: "Entwurf", cls: "bg-amber-500/15 text-amber-400 border-amber-500/40" };
  })();

  return (
    <div className="space-y-4">
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
              isCurrent ? "border-bulls-red bg-bulls-red/15 text-white" : "border-[#252525] bg-[#111] text-neutral-300 hover:text-white"
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
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-[#252525] bg-[#111] px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-bulls-red/60 hover:text-white"
            >
              <Bookmark className="h-3.5 w-3.5" /> Vorlagen ({templates.length})
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="mt-4 divide-y divide-[#1a1a1a] rounded-xl border border-[#252525] bg-[#111]">
          {enrichedSessions.map((s, i) => (
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
                    className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:border-red-500/40 hover:text-red-400"
                  >
                    Entfernen <Trash2 className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => patch(i, { active: true, title: s.title || "Team Training" })}
                      className="flex items-center gap-1 rounded-md border border-[#252525] bg-[#0f0f0f] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:border-bulls-red/60 hover:text-bulls-red"
                    >
                      <Plus className="h-3 w-3" /> Training
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplatePickerFor(i)}
                      disabled={!templates.length}
                      className="flex items-center gap-1 rounded-md border border-[#252525] bg-[#0f0f0f] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:border-bulls-red/60 hover:text-bulls-red disabled:opacity-40"
                    >
                      <Bookmark className="h-3 w-3" /> Vorlage
                    </button>
                  </div>
                )}
              </div>
              {s.active && (
                <>
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
                  <input
                    value={s.description}
                    onChange={(e) => patch(i, { description: e.target.value })}
                    placeholder="Beschreibung / Fokus (optional) — hilft bei der automatischen Erkennung"
                    className="mt-2 w-full rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600"
                  />
                  {/* Focus Row */}
                  <FocusRow
                    session={s}
                    onOverride={(f) =>
                      patch(i, {
                        focus: f,
                        focus_source: f === null ? "auto" : "manual",
                      })
                    }
                    onPreview={() => setPreviewSession(s)}
                    onSaveTemplate={() => {
                      setSaveTemplateFor(i);
                      setTemplateName(s.title || "");
                    }}
                  />
                </>
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
          Nach Veröffentlichung baut BodyFuel Performance für jeden Athleten eine
          positions- und belastungsabhängige Athletik-Session, sofern der Fokus nicht
          „Football" oder „Kein automatischer Athletikplan" ist. Bereits laufende oder
          abgeschlossene Sessions bleiben unberührt.
        </p>
      </div>

      {/* Template Picker Modal */}
      {templatePickerFor !== null && (
        <Modal onClose={() => setTemplatePickerFor(null)} title="Vorlage auswählen">
          {templates.length === 0 ? (
            <p className="text-sm text-neutral-400">Noch keine Vorlagen. Speichere zuerst eine Einheit als Vorlage.</p>
          ) : (
            <div className="space-y-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    applyTemplate(templatePickerFor, t);
                    setTemplatePickerFor(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#252525] bg-[#0a0a0a] px-3 py-2 text-left hover:border-bulls-red/60"
                >
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                      {FOCUS_LABEL[t.focus]} · {t.duration_min ? `${t.duration_min} Min` : "flexibel"}
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase text-bulls-red">Übernehmen →</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Save-Template Modal */}
      {saveTemplateFor !== null && (
        <Modal onClose={() => setSaveTemplateFor(null)} title="Als Vorlage speichern">
          <input
            autoFocus
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Vorlagenname (z. B. Gameday Recovery)"
            className="w-full rounded-md border border-[#252525] bg-[#0a0a0a] px-3 py-2 text-sm text-white"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSaveTemplateFor(null)}
              className="rounded-md border border-[#252525] bg-[#111] px-3 py-1.5 text-xs font-semibold text-neutral-300"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!templateName.trim() || saveTemplateMut.isPending}
              onClick={() => {
                const s = enrichedSessions[saveTemplateFor];
                saveTemplateMut.mutate(
                  { name: templateName.trim(), s },
                  {
                    onSuccess: () => {
                      setSaveTemplateFor(null);
                      setTemplateName("");
                    },
                  },
                );
              }}
              className="rounded-md bg-bulls-red px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
            >
              {saveTemplateMut.isPending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Speichern
            </button>
          </div>
        </Modal>
      )}

      {/* Preview Modal */}
      {previewSession && (
        <PreviewModal session={previewSession} onClose={() => setPreviewSession(null)} />
      )}

      {/* Manage Templates Modal */}
      {manageOpen && (
        <ManageTemplatesModal
          orgId={orgId}
          templates={templates}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function FocusRow({
  session,
  onOverride,
  onPreview,
  onSaveTemplate,
}: {
  session: EditorSession;
  onOverride: (f: TrainingFocus | null) => void;
  onPreview: () => void;
  onSaveTemplate: () => void;
}) {
  const focus = session.focus ?? "none";
  const isAthletic = focusTriggersAthleteSession(focus);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1.5">
      <Sparkles className="h-3.5 w-3.5 text-bulls-red" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {session.focus_source === "manual" ? "Fokus (manuell)" : "Erkannter Fokus"}
      </span>
      <select
        value={focus}
        onChange={(e) => onOverride(e.target.value as TrainingFocus)}
        className="rounded-md border border-[#252525] bg-[#0a0a0a] px-2 py-1 text-xs font-semibold text-white"
      >
        {FOCUS_CHOICES.map((f) => (
          <option key={f} value={f}>
            {FOCUS_LABEL[f]}
          </option>
        ))}
      </select>
      {isAthletic && (
        <button
          type="button"
          onClick={onPreview}
          className="ml-auto flex items-center gap-1 rounded-md border border-[#252525] bg-[#111] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:border-bulls-red/60 hover:text-bulls-red"
        >
          <Eye className="h-3 w-3" /> Spieler-Vorschau
        </button>
      )}
      <button
        type="button"
        onClick={onSaveTemplate}
        className={`flex items-center gap-1 rounded-md border border-[#252525] bg-[#111] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:border-bulls-red/60 hover:text-bulls-red ${isAthletic ? "" : "ml-auto"}`}
      >
        <BookmarkPlus className="h-3 w-3" /> Als Vorlage
      </button>
    </div>
  );
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-[#252525] bg-[#0f0f0f] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-lg font-bold text-white">{title}</h4>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PreviewModal({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const focus = session.focus;
  const positions: Array<[string, string]> = [
    ["QB", "Quarterback"],
    ["WR", "Wide Receiver"],
    ["OL", "Offensive Line"],
  ];
  const durationMin =
    session.start_time && session.end_time
      ? Math.max(
          15,
          Math.round(
            (parseInt(session.end_time.split(":")[0] || "0") * 60 +
              parseInt(session.end_time.split(":")[1] || "0") -
              (parseInt(session.start_time.split(":")[0] || "0") * 60 +
                parseInt(session.start_time.split(":")[1] || "0"))) || 45,
          ),
        )
      : 45;

  return (
    <Modal onClose={onClose} title="Spieler-Vorschau">
      <p className="mb-3 text-xs text-neutral-400">
        Erkannter Fokus: <span className="font-bold text-bulls-red">{focus ? FOCUS_LABEL[focus] : "—"}</span>
        <br />
        BodyFuel Performance erstellt für die Spieler positions- und belastungsabhängige Sessions.
      </p>
      {focus && focusTriggersAthleteSession(focus) ? (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {positions.map(([code, label]) => {
            const exercises = previewAthleteSession(focus as any, code, durationMin);
            return (
              <div key={code} className="rounded-lg border border-[#252525] bg-[#0a0a0a] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold text-white">{label} <span className="text-[10px] uppercase tracking-wider text-neutral-500">· {code}</span></div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">{durationMin} Min</div>
                </div>
                <ul className="space-y-1 text-xs text-neutral-300">
                  {exercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between gap-2 border-b border-[#1a1a1a] pb-1 last:border-b-0">
                      <span>{ex.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                        {ex.sets}×{ex.reps ?? (ex.duration_sec ? `${ex.duration_sec}s` : "-")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-neutral-400">
          Für diesen Fokus wird keine automatische Athletik-Session erzeugt.
        </p>
      )}
    </Modal>
  );
}

function ManageTemplatesModal({
  orgId,
  templates,
  onClose,
}: {
  orgId: string;
  templates: Template[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const updateTpl = useServerFn(updateTrainingTemplate);
  const dupTpl = useServerFn(duplicateTrainingTemplate);
  const delTpl = useServerFn(deleteTrainingTemplate);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const rename = useMutation({
    mutationFn: async (args: { id: string; name: string }) =>
      updateTpl({ data: { id: args.id, patch: { name: args.name } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-templates", orgId] });
      setRenameId(null);
      toast.success("Umbenannt.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler."),
  });
  const dup = useMutation({
    mutationFn: async (id: string) => dupTpl({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-templates", orgId] });
      toast.success("Dupliziert.");
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => delTpl({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-templates", orgId] });
      toast.success("Gelöscht. Bereits veröffentlichte Einheiten bleiben unberührt.");
    },
  });

  return (
    <Modal onClose={onClose} title="Vorlagen verwalten">
      {templates.length === 0 ? (
        <p className="text-sm text-neutral-400">Noch keine Vorlagen.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#252525] bg-[#0a0a0a] px-3 py-2"
            >
              {renameId === t.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameValue.trim()) {
                      rename.mutate({ id: t.id, name: renameValue.trim() });
                    }
                    if (e.key === "Escape") setRenameId(null);
                  }}
                  className="flex-1 rounded-md border border-[#252525] bg-[#111] px-2 py-1 text-sm text-white"
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {FOCUS_LABEL[t.focus]} · {t.duration_min ? `${t.duration_min} Min` : "flexibel"}
                  </div>
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRenameId(t.id);
                    setRenameValue(t.name);
                  }}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-[#111] hover:text-white"
                  title="Umbenennen"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => dup.mutate(t.id)}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-[#111] hover:text-white"
                  title="Duplizieren"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`„${t.name}" löschen? Bereits veröffentlichte Einheiten bleiben unberührt.`)) {
                      del.mutate(t.id);
                    }
                  }}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-red-500/20 hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

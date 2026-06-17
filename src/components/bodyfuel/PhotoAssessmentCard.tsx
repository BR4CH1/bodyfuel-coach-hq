import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listPhotoAssessments,
  savePhotoAssessment,
  deletePhotoAssessment,
  aiComparePhotos,
  type AssessmentOverall,
  type AssessmentSign,
  type PhotoAssessment,
} from "@/lib/photo-assessments.functions";
import { listProgressPhotos } from "@/lib/progress-photos.functions";

const SIGN_OPTIONS: AssessmentSign[] = ["+", "=", "-"];
const FIELDS: { key: keyof PhotoAssessment; group: "fat" | "muscle"; label: string }[] = [
  { key: "fat_belly", group: "fat", label: "Bauch" },
  { key: "fat_hip", group: "fat", label: "Hüfte" },
  { key: "fat_back", group: "fat", label: "Rücken" },
  { key: "muscle_chest", group: "muscle", label: "Brust" },
  { key: "muscle_shoulder", group: "muscle", label: "Schultern" },
  { key: "muscle_arms", group: "muscle", label: "Arme" },
  { key: "muscle_back", group: "muscle", label: "Rücken" },
  { key: "muscle_legs", group: "muscle", label: "Beine" },
];

const OVERALL_LABEL: Record<AssessmentOverall, string> = {
  strongly_improved: "Stark verbessert",
  improved: "Verbessert",
  unchanged: "Unverändert",
  worsened: "Verschlechtert",
};

export function PhotoAssessmentCard({
  userId,
  isCoach,
}: {
  userId: string;
  isCoach: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPhotoAssessments);
  const saveFn = useServerFn(savePhotoAssessment);
  const delFn = useServerFn(deletePhotoAssessment);
  const aiFn = useServerFn(aiComparePhotos);
  const photosFn = useServerFn(listProgressPhotos);

  const key = ["photo-assessments", userId];
  const { data: list = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  const photosQ = useQuery({
    queryKey: ["progress-photos", userId],
    queryFn: () => photosFn({ data: { userId } }),
    enabled: isCoach && !!userId,
  });

  const [draft, setDraft] = useState<Partial<PhotoAssessment> | null>(null);
  const [running, setRunning] = useState(false);

  const save = useMutation({
    mutationFn: (a: Partial<PhotoAssessment>) =>
      saveFn({ data: { ...a, user_id: userId } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setDraft(null);
      toast.success("Bewertung gespeichert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // For client-only view
  if (!isCoach) {
    const visible = list.filter((a) => a.released_to_client);
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Coach-Bewertungen</h2>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine freigegebenen Bewertungen.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((a) => <AssessmentRow key={a.id} a={a} />)}
          </ul>
        )}
      </div>
    );
  }

  const runAI = async () => {
    if (!photosQ.data) return;
    // Pick last 4 vs previous 4 (rough heuristic by taken_on grouping)
    const grouped: Record<string, typeof photosQ.data> = {};
    for (const p of photosQ.data) (grouped[p.taken_on] ??= []).push(p);
    const dates = Object.keys(grouped).sort().reverse();
    if (dates.length < 2) {
      toast.error("Mindestens 2 Foto-Sets (an verschiedenen Tagen) erforderlich.");
      return;
    }
    const after = grouped[dates[0]];
    const before = grouped[dates[1]];
    setRunning(true);
    try {
      const res = await aiFn({
        data: {
          user_id: userId,
          before_paths: before.map((p) => p.file_path),
          after_paths: after.map((p) => p.file_path),
        },
      });
      setDraft({
        ...res,
        before_date: dates[1],
        after_date: dates[0],
        released_to_client: false,
      });
      toast.success("KI-Vorschlag erstellt — bitte prüfen und speichern");
    } catch (e: any) {
      toast.error(e?.message ?? "KI Fehler");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Foto-Bewertungen (Coach)</h2>
        <div className="flex gap-2">
          <button
            onClick={runAI}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-accent/30 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-accent/50 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            KI-Vorschlag
          </button>
          {!draft && (
            <button
              onClick={() => setDraft({ released_to_client: false })}
              className="rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              Neu
            </button>
          )}
        </div>
      </div>

      {draft && (
        <div className="mb-4 space-y-3 rounded-xl border border-gold/30 bg-background/40 p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <div className="text-muted-foreground">Vorher</div>
              <input
                type="date" value={draft.before_date ?? ""}
                onChange={(e) => setDraft({ ...draft, before_date: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
            </label>
            <label>
              <div className="text-muted-foreground">Nachher</div>
              <input
                type="date" value={draft.after_date ?? ""}
                onChange={(e) => setDraft({ ...draft, after_date: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
            </label>
          </div>

          <div>
            <div className="mb-1 font-bold text-gold">Körperfett</div>
            <div className="grid grid-cols-3 gap-2">
              {FIELDS.filter((f) => f.group === "fat").map((f) => (
                <SignPick key={f.key as string} label={f.label}
                  value={(draft as any)[f.key] ?? null}
                  onChange={(v) => setDraft({ ...draft, [f.key]: v } as any)} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-bold text-gold">Muskulatur</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FIELDS.filter((f) => f.group === "muscle").map((f) => (
                <SignPick key={f.key as string} label={f.label}
                  value={(draft as any)[f.key] ?? null}
                  onChange={(v) => setDraft({ ...draft, [f.key]: v } as any)} />
              ))}
            </div>
          </div>

          <label>
            <div className="text-muted-foreground">Gesamteindruck</div>
            <select
              value={draft.overall ?? ""}
              onChange={(e) => setDraft({ ...draft, overall: (e.target.value || null) as any })}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">—</option>
              {(Object.keys(OVERALL_LABEL) as AssessmentOverall[]).map((o) => (
                <option key={o} value={o}>{OVERALL_LABEL[o]}</option>
              ))}
            </select>
          </label>

          <textarea
            value={draft.ai_summary ?? ""}
            onChange={(e) => setDraft({ ...draft, ai_summary: e.target.value })}
            placeholder="KI-Zusammenfassung / Notiz"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <textarea
            value={draft.coach_note ?? ""}
            onChange={(e) => setDraft({ ...draft, coach_note: e.target.value })}
            placeholder="Eigene Notiz (nur für Coach)"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!draft.released_to_client}
              onChange={(e) => setDraft({ ...draft, released_to_client: e.target.checked })}
            />
            Für Kunden freigeben
          </label>

          <div className="flex justify-end gap-2">
            <button onClick={() => setDraft(null)} className="rounded-md border border-border px-3 py-1.5">
              Abbrechen
            </button>
            <button
              onClick={() => save.mutate(draft)}
              disabled={save.isPending}
              className="rounded-md bg-gradient-gold px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Bewertungen.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-background/40 p-3">
              <AssessmentRow a={a} />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() =>
                    save.mutate({ ...a, released_to_client: !a.released_to_client })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]"
                >
                  {a.released_to_client ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {a.released_to_client ? "Zurückziehen" : "Freigeben"}
                </button>
                <button
                  onClick={() => setDraft(a)}
                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => del.mutate(a.id)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-warning"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignPick({
  label, value, onChange,
}: {
  label: string;
  value: AssessmentSign | null;
  onChange: (v: AssessmentSign | null) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="flex gap-0.5">
        {SIGN_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange(value === s ? null : s)}
            className={`flex-1 rounded border px-1 py-1 text-xs font-bold ${
              value === s
                ? s === "+" ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                  : s === "-" ? "border-rose-500 bg-rose-500/20 text-rose-400"
                  : "border-amber-500 bg-amber-500/20 text-amber-400"
                : "border-border text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssessmentRow({ a }: { a: PhotoAssessment }) {
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground">
          {a.before_date ? new Date(a.before_date).toLocaleDateString("de-DE") : "—"} →{" "}
          {new Date(a.after_date).toLocaleDateString("de-DE")}
        </div>
        {a.overall && (
          <div className="font-bold text-gold">{OVERALL_LABEL[a.overall]}</div>
        )}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {FIELDS.map((f) => {
          const v = (a as any)[f.key] as AssessmentSign | null;
          if (!v) return null;
          return (
            <div key={f.key as string} className="rounded bg-background/60 px-1.5 py-0.5">
              <span className="text-muted-foreground">{f.label}: </span>
              <span className={
                v === "+" ? "text-emerald-400 font-bold" :
                v === "-" ? "text-rose-400 font-bold" : "text-amber-400 font-bold"
              }>{v}</span>
            </div>
          );
        })}
      </div>
      {a.ai_summary && <p className="mt-2 italic text-muted-foreground">{a.ai_summary}</p>}
    </div>
  );
}

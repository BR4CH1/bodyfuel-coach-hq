import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, Type, Plus, Trash2, Loader2, Save, Wand2 } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  parseCustomerTrainingPlan,
  saveCustomerTrainingPlan,
  type ImportedPlan,
  type ImportedDay,
  type ImportedExercise,
} from "@/lib/customer-training-plan.functions";

export const Route = createFileRoute("/training-import")({
  head: () => ({ meta: [{ title: "Eigenen Trainingsplan importieren — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ImportPage />
    </AppLayout>
  ),
});

type Mode = "upload" | "text" | "manual";

const emptyExercise = (): ImportedExercise => ({
  name: "",
  category: null,
  target_sets: 3,
  target_reps: "8",
  target_weights: null,
  rest_seconds: 90,
  notes: null,
});
const emptyDay = (): ImportedDay => ({
  name: "Trainingstag",
  focus: null,
  week_number: 1,
  exercises: [emptyExercise()],
});

function ImportPage() {
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const parseFn = useServerFn(parseCustomerTrainingPlan);
  const saveFn = useServerFn(saveCustomerTrainingPlan);

  const [mode, setMode] = useState<Mode>("upload");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<ImportedPlan>({
    title: "",
    weeks_count: 1,
    days: [emptyDay()],
  });

  if (!supabaseUser) {
    return <p className="text-sm text-muted-foreground">Bitte einloggen.</p>;
  }

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Datei zu groß (max. 15 MB)");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const res = await parseFn({
        data: {
          mode: isPdf ? "pdf" : "image",
          payload: dataUrl,
          filename: file.name,
        },
      });
      setPlan({ ...res, title: res.title || file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "") });
      toast.success("Plan erkannt — bitte prüfen und speichern.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht lesen");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const parseText = async () => {
    if (text.trim().length < 20) return toast.error("Bitte mehr Text einfügen.");
    setBusy(true);
    try {
      const res = await parseFn({ data: { mode: "text", payload: text } });
      setPlan({ ...res, title: res.title || "Eigener Trainingsplan" });
      toast.success("Plan erkannt — bitte prüfen und speichern.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht parsen");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!plan.days.length || !plan.days.some((d) => d.exercises.some((e) => e.name.trim()))) {
      return toast.error("Mindestens eine Übung erforderlich.");
    }
    setSaving(true);
    try {
      const cleaned: ImportedPlan = {
        ...plan,
        days: plan.days
          .map((d) => ({
            ...d,
            exercises: d.exercises.filter((e) => e.name.trim()),
          }))
          .filter((d) => d.exercises.length),
      };
      await saveFn({ data: { plan: cleaned } });
      toast.success("Plan gespeichert und aktiviert!");
      navigate({ to: "/training" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (i: number, patch: Partial<ImportedDay>) =>
    setPlan((p) => ({ ...p, days: p.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) }));
  const updateEx = (di: number, ei: number, patch: Partial<ImportedExercise>) =>
    setPlan((p) => ({
      ...p,
      days: p.days.map((d, idx) =>
        idx === di
          ? { ...d, exercises: d.exercises.map((e, eidx) => (eidx === ei ? { ...e, ...patch } : e)) }
          : d,
      ),
    }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Training</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Eigenen Plan importieren</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lade deinen bestehenden Trainingsplan hoch, füge ihn als Text ein oder erstelle ihn manuell.
          Dein Coach kann später jederzeit einen neuen Plan freigeben.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ModeButton active={mode === "upload"} onClick={() => setMode("upload")} icon={<Upload className="h-4 w-4" />} label="PDF / Bild" />
        <ModeButton active={mode === "text"} onClick={() => setMode("text")} icon={<Type className="h-4 w-4" />} label="Text einfügen" />
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")} icon={<FileText className="h-4 w-4" />} label="Manuell" />
      </div>

      {mode === "upload" && (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">PDF oder Bild hochladen</h2>
          <p className="mt-1 text-xs text-muted-foreground">Die KI extrahiert Tage, Übungen, Sätze und Wiederholungen automatisch.</p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Lese Plan..." : "Datei wählen"}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} disabled={busy} />
          </label>
        </div>
      )}

      {mode === "text" && (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">Plan als Text einfügen</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Beispiel:\nTag 1 — Push\nBankdrücken 4x8 60kg\nSchulterdrücken 3x10 25kg\n..."}
            rows={10}
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={parseText}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Mit KI strukturieren
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Plan-Editor</h2>
        <p className="mt-1 text-xs text-muted-foreground">Prüfe, ergänze oder korrigiere die Übungen. Speichern aktiviert den Plan.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={plan.title ?? ""}
            onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
            placeholder="Titel des Plans"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Wochen:
            <input
              type="number"
              min={1}
              max={12}
              value={plan.weeks_count ?? 1}
              onChange={(e) => setPlan((p) => ({ ...p, weeks_count: Math.max(1, Math.min(12, Number(e.target.value) || 1)) }))}
              className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 space-y-4">
          {plan.days.map((d, di) => (
            <div key={di} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={d.name}
                  onChange={(e) => updateDay(di, { name: e.target.value })}
                  className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold"
                />
                <input
                  value={d.focus ?? ""}
                  onChange={(e) => updateDay(di, { focus: e.target.value || null })}
                  placeholder="Fokus (z.B. Push)"
                  className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={d.week_number ?? 1}
                  onChange={(e) => updateDay(di, { week_number: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  title="Woche"
                />
                <button
                  onClick={() => setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }))}
                  className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                  aria-label="Tag löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {d.exercises.map((ex, ei) => (
                  <div key={ei} className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-[2fr_60px_80px_100px_80px_32px]">
                    <input
                      value={ex.name}
                      onChange={(e) => updateEx(di, ei, { name: e.target.value })}
                      placeholder="Übung"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={ex.target_sets ?? ""}
                      onChange={(e) => updateEx(di, ei, { target_sets: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Sätze"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      value={ex.target_reps ?? ""}
                      onChange={(e) => updateEx(di, ei, { target_reps: e.target.value || null })}
                      placeholder="Wdh."
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      value={ex.target_weights ?? ""}
                      onChange={(e) => updateEx(di, ei, { target_weights: e.target.value || null })}
                      placeholder="kg"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={ex.rest_seconds ?? ""}
                      onChange={(e) => updateEx(di, ei, { rest_seconds: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Pause s"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() =>
                        updateDay(di, { exercises: d.exercises.filter((_, i) => i !== ei) })
                      }
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Übung löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updateDay(di, { exercises: [...d.exercises, emptyExercise()] })}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-gold/50"
                >
                  <Plus className="h-3 w-3" /> Übung
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setPlan((p) => ({ ...p, days: [...p.days, emptyDay()] }))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-gold/50"
          >
            <Plus className="h-4 w-4" /> Tag hinzufügen
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Plan speichern & aktivieren
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
        active ? "border-gold/60 bg-gold/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-gold/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

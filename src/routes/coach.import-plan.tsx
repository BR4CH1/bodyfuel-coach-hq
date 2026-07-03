import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, Type, Plus, Trash2, Loader2, Save, Wand2 } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  parseCustomerTrainingPlan,
  type ImportedPlan as ImportedTrainingPlan,
  type ImportedDay as ImportedTrainingDay,
  type ImportedExercise,
} from "@/lib/customer-training-plan.functions";
import {
  saveCoachTrainingPlanDraft,
  parseCoachNutritionPlan,
  saveCoachNutritionPlanDraft,
  type ImportedNutritionPlan,
  type ImportedNutritionDay,
  type ImportedNutritionMeal,
  type NutritionSaveMode,
} from "@/lib/coach-plan-import.functions";
import { listCustomerNutritionPlans } from "@/lib/coach-plan-history.functions";

type PlanType = "training" | "nutrition";
type Mode = "upload" | "text" | "manual";

export const Route = createFileRoute("/coach/import-plan")({
  validateSearch: (s: Record<string, unknown>) => ({
    client: typeof s.client === "string" ? s.client : "",
    type: (s.type === "nutrition" ? "nutrition" : "training") as PlanType,
  }),
  head: () => ({ meta: [{ title: "Eigenen Plan importieren — Coach" }] }),
  component: () => (
    <AppLayout>
      <ImportPage />
    </AppLayout>
  ),
});

const emptyExercise = (): ImportedExercise => ({
  name: "", category: null, target_sets: 3, target_reps: "8",
  target_weights: null, rest_seconds: 90, notes: null,
});
const emptyTrainingDay = (): ImportedTrainingDay => ({
  name: "Trainingstag", focus: null, week_number: 1, exercises: [emptyExercise()],
});
const emptyMeal = (): ImportedNutritionMeal => ({
  slot: "breakfast", name: "", description: null, ingredients: [{ name: "", grams: 100 }],
});
const emptyNutritionDay = (): ImportedNutritionDay => ({
  name: "Tag 1", meals: [emptyMeal()],
});

function ImportPage() {
  const { supabaseUser, isCoach } = useSession();
  const navigate = useNavigate();
  const { client, type } = Route.useSearch();

  const parseTrFn = useServerFn(parseCustomerTrainingPlan);
  const saveTrFn = useServerFn(saveCoachTrainingPlanDraft);
  const parseNuFn = useServerFn(parseCoachNutritionPlan);
  const saveNuFn = useServerFn(saveCoachNutritionPlanDraft);
  const listPlansFn = useServerFn(listCustomerNutritionPlans);

  const [mode, setMode] = useState<Mode>("upload");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");

  const [trPlan, setTrPlan] = useState<ImportedTrainingPlan>({
    title: "", weeks_count: 1, days: [emptyTrainingDay()],
  });
  const [nuPlan, setNuPlan] = useState<ImportedNutritionPlan>({
    title: "", days: [emptyNutritionDay()],
  });

  // Speicher-Modi (nur Ernährung)
  const [saveMode, setSaveMode] = useState<NutritionSaveMode>("new_plan");
  const [targetPlanId, setTargetPlanId] = useState<string>("");
  const [targetWeekNumber, setTargetWeekNumber] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const plansQuery = useQuery({
    queryKey: ["coach-nutrition-plans", client],
    queryFn: () => listPlansFn({ data: { client_id: client } }),
    enabled: !!client && type === "nutrition" && !!supabaseUser && isCoach,
  });

  if (!supabaseUser) return <p className="text-sm text-muted-foreground">Bitte einloggen.</p>;
  if (!isCoach) return <p className="text-sm text-destructive">Nur für Coaches.</p>;
  if (!client) return <p className="text-sm text-destructive">Kein Kunde ausgewählt.</p>;

  const fileToDataUrl = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
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
      const payload = { mode: (isPdf ? "pdf" : "image") as "pdf" | "image", payload: dataUrl, filename: file.name };
      if (type === "training") {
        const res = await parseTrFn({ data: payload });
        setTrPlan({ ...res, title: res.title || file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "") });
      } else {
        const res = await parseNuFn({ data: payload });
        setNuPlan({ ...res, title: res.title || file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "") });
      }
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
      if (type === "training") {
        const res = await parseTrFn({ data: { mode: "text", payload: text } });
        setTrPlan({ ...res, title: res.title || "Eigener Trainingsplan" });
      } else {
        const res = await parseNuFn({ data: { mode: "text", payload: text } });
        setNuPlan({ ...res, title: res.title || "Eigener Ernährungsplan" });
      }
      toast.success("Plan erkannt — bitte prüfen und speichern.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht parsen");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (type === "training") {
        if (!trPlan.days.some((d) => d.exercises.some((e) => e.name.trim()))) {
          throw new Error("Mindestens eine Übung erforderlich.");
        }
        const cleaned: ImportedTrainingPlan = {
          ...trPlan,
          days: trPlan.days
            .map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.name.trim()) }))
            .filter((d) => d.exercises.length),
        };
        await saveTrFn({ data: { client_id: client, plan: cleaned, title: trPlan.title } });
      } else {
        if (!nuPlan.days.some((d) => d.meals.some((m) => m.name.trim() && m.ingredients.some((i) => i.name.trim())))) {
          throw new Error("Mindestens eine Mahlzeit mit Zutaten erforderlich.");
        }
        const cleaned: ImportedNutritionPlan = {
          ...nuPlan,
          days: nuPlan.days
            .map((d) => ({
              ...d,
              meals: d.meals
                .filter((m) => m.name.trim())
                .map((m) => ({ ...m, ingredients: m.ingredients.filter((i) => i.name.trim()) }))
                .filter((m) => m.ingredients.length),
            }))
            .filter((d) => d.meals.length),
        };
        await saveNuFn({ data: { client_id: client, plan: cleaned, title: nuPlan.title } });
      }
      toast.success("Plan als Entwurf gespeichert.");
      navigate({ to: "/coach/customers/$userId", params: { userId: client } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = type === "training" ? "Trainingsplan" : "Ernährungsplan";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Coach · Import
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Eigenen {typeLabel} importieren
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lade PDF/Bild hoch, füge Text ein oder erstelle manuell. Der Plan wird als
          Entwurf für den Kunden angelegt — du gibst ihn anschließend wie gewohnt frei.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ModeBtn active={mode === "upload"} onClick={() => setMode("upload")} icon={<Upload className="h-4 w-4" />} label="PDF / Bild" />
        <ModeBtn active={mode === "text"} onClick={() => setMode("text")} icon={<Type className="h-4 w-4" />} label="Text einfügen" />
        <ModeBtn active={mode === "manual"} onClick={() => setMode("manual")} icon={<FileText className="h-4 w-4" />} label="Manuell" />
      </div>

      {mode === "upload" && (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">PDF oder Bild hochladen</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Die KI extrahiert die Struktur. {type === "nutrition" ? "Nährwerte werden serverseitig aus der DB berechnet." : "Übungen, Sätze, Wiederholungen werden erkannt."}
          </p>
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
            placeholder={type === "training"
              ? "Beispiel:\nTag 1 — Push\nBankdrücken 4x8 60kg\n..."
              : "Beispiel:\nTag 1\nFrühstück: 80g Haferflocken, 150g Apfel, 200g Milch\nMittag: 200g Hähnchen, 150g Reis, 200g Brokkoli\n..."}
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

      {type === "training" ? (
        <TrainingEditor plan={trPlan} setPlan={setTrPlan} />
      ) : (
        <NutritionEditor plan={nuPlan} setPlan={setNuPlan} />
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Als Entwurf speichern
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
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

// ───────────── Training editor (reuses customer-import look) ─────────────

function TrainingEditor({
  plan, setPlan,
}: { plan: ImportedTrainingPlan; setPlan: React.Dispatch<React.SetStateAction<ImportedTrainingPlan>> }) {
  const updateDay = (i: number, patch: Partial<ImportedTrainingDay>) =>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Plan-Editor</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
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
            type="number" min={1} max={12}
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
              <input value={d.name} onChange={(e) => updateDay(di, { name: e.target.value })}
                className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold" />
              <input value={d.focus ?? ""} onChange={(e) => updateDay(di, { focus: e.target.value || null })}
                placeholder="Fokus (z.B. Push)"
                className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
              <input type="number" min={1} max={12} value={d.week_number ?? 1}
                onChange={(e) => updateDay(di, { week_number: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm" title="Woche" />
              <button onClick={() => setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }))}
                className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {d.exercises.map((ex, ei) => (
                <div key={ei} className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-[2fr_60px_80px_100px_80px_32px]">
                  <input value={ex.name} onChange={(e) => updateEx(di, ei, { name: e.target.value })}
                    placeholder="Übung" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  <input type="number" value={ex.target_sets ?? ""}
                    onChange={(e) => updateEx(di, ei, { target_sets: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Sätze" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  <input value={ex.target_reps ?? ""}
                    onChange={(e) => updateEx(di, ei, { target_reps: e.target.value || null })}
                    placeholder="Wdh." className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  <input value={ex.target_weights ?? ""}
                    onChange={(e) => updateEx(di, ei, { target_weights: e.target.value || null })}
                    placeholder="kg" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  <input type="number" value={ex.rest_seconds ?? ""}
                    onChange={(e) => updateEx(di, ei, { rest_seconds: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Pause s" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  <button onClick={() => updateDay(di, { exercises: d.exercises.filter((_, i) => i !== ei) })}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => updateDay(di, { exercises: [...d.exercises, emptyExercise()] })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-gold/50">
                <Plus className="h-3 w-3" /> Übung
              </button>
            </div>
          </div>
        ))}
        <button onClick={() => setPlan((p) => ({ ...p, days: [...p.days, emptyTrainingDay()] }))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-gold/50">
          <Plus className="h-4 w-4" /> Tag hinzufügen
        </button>
      </div>
    </div>
  );
}

// ───────────── Nutrition editor ─────────────

const SLOT_LABELS: Record<ImportedNutritionMeal["slot"], string> = {
  breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snack: "Snack",
};

function NutritionEditor({
  plan, setPlan,
}: { plan: ImportedNutritionPlan; setPlan: React.Dispatch<React.SetStateAction<ImportedNutritionPlan>> }) {
  const updDay = (i: number, patch: Partial<ImportedNutritionDay>) =>
    setPlan((p) => ({ ...p, days: p.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) }));
  const updMeal = (di: number, mi: number, patch: Partial<ImportedNutritionMeal>) =>
    setPlan((p) => ({
      ...p,
      days: p.days.map((d, idx) => idx === di
        ? { ...d, meals: d.meals.map((m, i) => i === mi ? { ...m, ...patch } : m) }
        : d),
    }));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Plan-Editor</h2>
      <input
        type="text"
        value={plan.title ?? ""}
        onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
        placeholder="Titel des Plans"
        className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-4">
        {plan.days.map((d, di) => (
          <div key={di} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input value={d.name} onChange={(e) => updDay(di, { name: e.target.value })}
                className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold" />
              <select
                value={d.type ?? ""}
                onChange={(e) => updDay(di, { type: (e.target.value || undefined) as any })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— Typ —</option>
                <option value="training">Training</option>
                <option value="rest">Rest</option>
              </select>
              <button onClick={() => setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }))}
                className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {d.meals.map((m, mi) => (
                <div key={mi} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={m.slot}
                      onChange={(e) => updMeal(di, mi, { slot: e.target.value as ImportedNutritionMeal["slot"] })}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      {(Object.keys(SLOT_LABELS) as Array<ImportedNutritionMeal["slot"]>).map((k) => (
                        <option key={k} value={k}>{SLOT_LABELS[k]}</option>
                      ))}
                    </select>
                    <input
                      value={m.name}
                      onChange={(e) => updMeal(di, mi, { name: e.target.value })}
                      placeholder="Mahlzeitname"
                      className="flex-1 min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <button onClick={() => updDay(di, { meals: d.meals.filter((_, i) => i !== mi) })}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {m.ingredients.map((ing, ii) => (
                      <div key={ii} className="grid gap-2 sm:grid-cols-[3fr_80px_32px]">
                        <input
                          value={ing.name}
                          onChange={(e) => updMeal(di, mi, {
                            ingredients: m.ingredients.map((x, i) => i === ii ? { ...x, name: e.target.value } : x),
                          })}
                          placeholder="Zutat (z.B. Haferflocken)"
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          value={ing.grams ?? ""}
                          onChange={(e) => updMeal(di, mi, {
                            ingredients: m.ingredients.map((x, i) => i === ii ? { ...x, grams: e.target.value ? Number(e.target.value) : null } : x),
                          })}
                          placeholder="g"
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                        <button onClick={() => updMeal(di, mi, { ingredients: m.ingredients.filter((_, i) => i !== ii) })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => updMeal(di, mi, { ingredients: [...m.ingredients, { name: "", grams: 100 }] })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-gold/50">
                      <Plus className="h-3 w-3" /> Zutat
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => updDay(di, { meals: [...d.meals, emptyMeal()] })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-gold/50">
                <Plus className="h-3 w-3" /> Mahlzeit
              </button>
            </div>
          </div>
        ))}
        <button onClick={() => setPlan((p) => ({ ...p, days: [...p.days, { ...emptyNutritionDay(), name: `Tag ${p.days.length + 1}` }] }))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-gold/50">
          <Plus className="h-4 w-4" /> Tag hinzufügen
        </button>
      </div>
    </div>
  );
}

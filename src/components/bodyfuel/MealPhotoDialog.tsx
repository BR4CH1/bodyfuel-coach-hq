import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon, Loader2, Sparkles, X, Plus, Trash2, AlertTriangle, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeMealPhoto, type MealPhotoIngredient, type MealPhotoResult } from "@/lib/meal-photo.functions";
import { saveCustomMeal } from "@/lib/custom-meals.functions";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const SLOTS: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Frühstück" },
  { key: "lunch", label: "Mittag" },
  { key: "dinner", label: "Abend" },
  { key: "snack", label: "Snack" },
];

type EditableIngredient = MealPhotoIngredient & {
  clientId: string;
  answer?: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function macrosFor(ing: EditableIngredient) {
  const m = ing.matched;
  if (!m) return { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 };
  // ml → g via 1.0 (Standard-Dichte fürs UI; Detail-Tuning bleibt beim Datenbestand)
  const grams =
    ing.unit === "piece"
      ? ing.estimated_amount * (m.piece_g ?? 100)
      : ing.estimated_amount;
  const f = grams / 100;
  return {
    grams,
    kcal: m.kcal_per_100g * f,
    protein: m.protein_per_100g * f,
    carbs: m.carbs_per_100g * f,
    fat: m.fat_per_100g * f,
  };
}

async function fileToDataUrl(file: File, maxDim = 1400): Promise<string> {
  // Downscale + jpeg encode für die AI (kleinere Payload, schneller).
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function MealPhotoDialog({
  open,
  onClose,
  defaultSlot,
  entryDate,
  onTracked,
}: {
  open: boolean;
  onClose: () => void;
  defaultSlot: MealSlot;
  entryDate: string;
  onTracked?: () => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<MealPhotoResult | null>(null);
  const [dishName, setDishName] = useState("");
  const [items, setItems] = useState<EditableIngredient[]>([]);
  const [portionScale, setPortionScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const analyzeFn = useServerFn(analyzeMealPhoto);
  const saveMealFn = useServerFn(saveCustomMeal);

  const analyze = useMutation({
    mutationFn: (input: { image_data_url: string; note?: string }) =>
      analyzeFn({ data: input }),
    onSuccess: (r) => {
      setResult(r);
      setDishName(r.dish_name);
      setItems(
        r.ingredients.map((i) => ({ ...i, clientId: uid() })),
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "AI-Analyse fehlgeschlagen"),
  });

  useEffect(() => {
    if (!open) {
      // reset on close
      setImageDataUrl(null);
      setNote("");
      setResult(null);
      setDishName("");
      setItems([]);
      setPortionScale(1);
      setAnswers({});
    }
  }, [open]);

  const totals = useMemo(() => {
    const t = items.reduce(
      (acc, i) => {
        const m = macrosFor(i);
        return {
          kcal: acc.kcal + m.kcal,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      kcal: Math.round(t.kcal * portionScale),
      protein: +(t.protein * portionScale).toFixed(1),
      carbs: +(t.carbs * portionScale).toFixed(1),
      fat: +(t.fat * portionScale).toFixed(1),
    };
  }, [items, portionScale]);

  const anyUnmatched = items.some((i) => !i.matched);

  const pickFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setImageDataUrl(url);
      setResult(null);
      setItems([]);
    } catch {
      toast.error("Bild konnte nicht geladen werden");
    }
  };

  const runAnalyze = () => {
    if (!imageDataUrl) return;
    const combinedNote = [
      note.trim(),
      ...Object.entries(answers)
        .map(([i, v]) => (result?.questions[Number(i)] ? `${result.questions[Number(i)]} → ${v}` : ""))
        .filter(Boolean),
    ]
      .filter(Boolean)
      .join(" | ");
    analyze.mutate({ image_data_url: imageDataUrl, note: combinedNote || undefined });
  };

  const updateItem = (id: string, patch: Partial<EditableIngredient>) =>
    setItems((prev) => prev.map((i) => (i.clientId === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.clientId !== id));

  const addBlankItem = () =>
    setItems((prev) => [
      ...prev,
      {
        clientId: uid(),
        name: "",
        estimated_amount: 100,
        unit: "g",
        confidence: 1,
        needs_confirmation: true,
        matched: null,
      },
    ]);

  const trackToSlot = async (slot: MealSlot) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Nicht angemeldet");
      return;
    }
    const valid = items.filter((i) => i.matched && i.name.trim() && i.estimated_amount > 0);
    if (valid.length === 0) {
      toast.error("Keine Zutat mit Nährwerten — bitte prüfen/bearbeiten.");
      return;
    }
    setSaving(true);
    try {
      const rows = valid.map((i) => {
        const m = macrosFor(i);
        return {
          user_id: user.id,
          entry_date: entryDate,
          meal: slot,
          name: i.name,
          serving_g: +(m.grams * portionScale).toFixed(1),
          kcal: Math.round(m.kcal * portionScale),
          protein_g: +(m.protein * portionScale).toFixed(1),
          carbs_g: +(m.carbs * portionScale).toFixed(1),
          fat_g: +(m.fat * portionScale).toFixed(1),
          source: "ai_photo",
        };
      });
      const { error } = await supabase.from("food_entries").insert(rows);
      if (error) throw error;
      toast.success(`${valid.length} Zutat(en) zu ${SLOTS.find((s) => s.key === slot)?.label} gebucht`);
      onTracked?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const saveAsCustomMeal = async () => {
    const valid = items.filter((i) => i.name.trim() && i.estimated_amount > 0);
    if (valid.length === 0) return toast.error("Keine Zutaten");
    try {
      await saveMealFn({
        data: {
          name: dishName.trim() || "Foto-Gericht",
          meal_slot: "any",
          ingredients: valid.map((i) => {
            const m = macrosFor(i);
            return {
              name: i.name,
              amount_g: +(m.grams * portionScale).toFixed(1) || null,
              kcal: Math.round(m.kcal * portionScale) || null,
              protein_g: +(m.protein * portionScale).toFixed(1) || null,
              carbs_g: +(m.carbs * portionScale).toFixed(1) || null,
              fat_g: +(m.fat * portionScale).toFixed(1) || null,
            };
          }),
        },
      });
      toast.success("Als eigenes Gericht gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-gold" />
            Gericht fotografieren
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-secondary" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Schritt 1: Foto */}
          {!result && (
            <div className="space-y-3">
              {imageDataUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-background/40">
                  <img src={imageDataUrl} alt="Mahlzeit" className="w-full object-cover" />
                  <button
                    onClick={() => setImageDataUrl(null)}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                    aria-label="Neu"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background/40 p-6 text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-gold" />
                  <div className="text-sm font-semibold">Deine Mahlzeit fotografieren</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fotografiere die gesamte Mahlzeit möglichst von oben. Für bessere Ergebnisse Teller,
                    Beilagen und Getränke vollständig aufnehmen.
                  </p>
                </div>
              )}

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4" /> Kamera
                </Button>
                <Button variant="outline" onClick={() => galleryInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" /> Galerie
                </Button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Optional: Kurzer Hinweis (z.B. „Reis gekocht, Sauce Tomate")
                </label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optionaler Hinweis für die AI"
                  maxLength={200}
                />
              </div>

              <Button
                className="w-full"
                onClick={runAnalyze}
                disabled={!imageDataUrl || analyze.isPending}
              >
                {analyze.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deine Mahlzeit wird analysiert …
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Analysieren
                  </>
                )}
              </Button>

              {analyze.isPending && (
                <div className="space-y-2">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="h-10 animate-pulse rounded-md bg-secondary/50" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schritt 2: Bestätigung */}
          {result && (
            <div className="space-y-4">
              {/* AI-Schätzung Hinweis */}
              <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <span>
                  AI-Schätzung – bitte Mengen und Zutaten kurz prüfen. Kalorien & Makros
                  stammen aus der BodyFuel-Lebensmitteldatenbank.
                </span>
              </div>

              {/* Dish name */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Gericht</label>
                <Input value={dishName} onChange={(e) => setDishName(e.target.value)} />
              </div>

              {/* Portion size */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Portion</label>
                <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/40 p-0.5 text-xs">
                  {[
                    { v: 0.75, l: "Klein" },
                    { v: 1, l: "Normal" },
                    { v: 1.3, l: "Groß" },
                  ].map((p) => (
                    <button
                      key={p.v}
                      onClick={() => setPortionScale(p.v)}
                      className={`rounded px-2 py-1.5 ${
                        Math.abs(portionScale - p.v) < 0.01
                          ? "bg-gold text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rückfragen */}
              {result.questions.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gold">
                    Kurze Rückfragen
                  </div>
                  {result.questions.map((q, i) => (
                    <div key={i}>
                      <div className="mb-1 text-xs">{q}</div>
                      <Input
                        value={answers[i] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                        placeholder="Antwort (optional)"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runAnalyze}
                    disabled={analyze.isPending}
                  >
                    <Sparkles className="h-3 w-3" /> Mit Antworten neu analysieren
                  </Button>
                </div>
              )}

              {/* Ingredients */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Zutaten
                  </div>
                  <button onClick={addBlankItem} className="text-xs text-gold hover:underline">
                    + Zutat
                  </button>
                </div>
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    Keine Zutaten erkannt. Füge sie manuell hinzu oder mach ein neues Foto.
                  </div>
                )}
                {items.map((i) => {
                  const m = macrosFor(i);
                  const unsure = !i.matched || i.needs_confirmation;
                  return (
                    <div
                      key={i.clientId}
                      className={`rounded-lg border p-3 ${
                        unsure ? "border-warning/60 bg-warning/5" : "border-border bg-background/40"
                      }`}
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <Input
                          value={i.name}
                          onChange={(e) => updateItem(i.clientId, { name: e.target.value })}
                          className="text-sm font-medium"
                        />
                        <button
                          onClick={() => removeItem(i.clientId)}
                          className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-warning"
                          aria-label="Zutat entfernen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-[1fr_100px] gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={i.estimated_amount}
                          onChange={(e) =>
                            updateItem(i.clientId, {
                              estimated_amount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                        <select
                          value={i.unit}
                          onChange={(e) =>
                            updateItem(i.clientId, {
                              unit: e.target.value as "g" | "ml" | "piece",
                            })
                          }
                          className="rounded-md border border-border bg-background px-2 text-sm"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="piece">Stück</option>
                        </select>
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        {i.matched ? (
                          <>
                            {Math.round(m.kcal)} kcal · P {m.protein.toFixed(1)} · K {m.carbs.toFixed(1)} · F {m.fat.toFixed(1)}
                            {i.matched.verified_by_coach ? " · ✓ verifiziert" : ""}
                          </>
                        ) : (
                          <span className="text-warning">
                            <AlertTriangle className="mr-1 inline h-3 w-3" />
                            Kein Datenbank-Match — bitte Name anpassen (z.B. „Reis, gekocht")
                          </span>
                        )}
                        {i.confidence < 0.7 && i.matched && (
                          <span className="ml-2 text-warning">Unsichere Erkennung</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Summe (nach Portion)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="font-display text-2xl font-bold">{totals.kcal} kcal</div>
                  <div className="text-xs text-muted-foreground">
                    P {totals.protein} · K {totals.carbs} · F {totals.fat}
                  </div>
                </div>
              </div>

              {anyUnmatched && (
                <div className="rounded-lg border border-warning/60 bg-warning/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="mr-1 inline h-3 w-3 text-warning" />
                  Zutaten ohne Datenbank-Match werden beim Tracken übersprungen. Bitte Namen prüfen
                  oder Zutat entfernen.
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Als Mahlzeit tracken
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SLOTS.map((s) => (
                    <Button
                      key={s.key}
                      variant={s.key === defaultSlot ? "default" : "outline"}
                      disabled={saving}
                      onClick={() => trackToSlot(s.key)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={saveAsCustomMeal} disabled={saving}>
                  <Save className="h-4 w-4" /> Als eigenes Gericht speichern
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setImageDataUrl(null);
                    setItems([]);
                  }}
                >
                  <Camera className="h-4 w-4" /> Neues Foto
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

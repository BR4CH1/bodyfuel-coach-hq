import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  ImageIcon,
  Loader2,
  Sparkles,
  X,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Save,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzeMealPhoto,
  matchIngredientName,
  learnFoodAlias,
  type FoodMatch,
  type MealPhotoIngredient,
  type MealPhotoResult,
  type MatchStatus,
} from "@/lib/meal-photo.functions";
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
  originalName: string; // Ursprünglicher AI-Name für Alias-Lernen
  user_confirmed?: boolean; // Nutzer hat aktiv bestätigt (Auswahl / Bearbeitung)
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function macrosFor(ing: EditableIngredient) {
  const m = ing.matched;
  if (!m) return { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 };
  const grams =
    ing.unit === "piece" ? ing.estimated_amount * (m.piece_g ?? 100) : ing.estimated_amount;
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
  const [searchTermByItem, setSearchTermByItem] = useState<Record<string, string>>({});

  const analyzeFn = useServerFn(analyzeMealPhoto);
  const matchFn = useServerFn(matchIngredientName);
  const learnFn = useServerFn(learnFoodAlias);
  const saveMealFn = useServerFn(saveCustomMeal);

  const analyze = useMutation({
    mutationFn: (input: { image_data_url: string; note?: string }) =>
      analyzeFn({ data: input }),
    onSuccess: (r) => {
      setResult(r);
      setDishName(r.dish_name);
      setItems(
        r.ingredients.map((i) => ({
          ...i,
          clientId: uid(),
          originalName: i.name,
        })),
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "AI-Analyse fehlgeschlagen"),
  });

  useEffect(() => {
    if (!open) {
      setImageDataUrl(null);
      setNote("");
      setResult(null);
      setDishName("");
      setItems([]);
      setPortionScale(1);
      setAnswers({});
      setSearchTermByItem({});
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

  const unresolvedCount = items.filter((i) => !i.matched).length;
  const matchedCount = items.filter((i) => !!i.matched).length;

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
        .map(([i, v]) =>
          result?.questions[Number(i)] ? `${result.questions[Number(i)]} → ${v}` : "",
        )
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
        originalName: "",
        name: "",
        estimated_amount: 100,
        unit: "g",
        confidence: 1,
        needs_confirmation: true,
        match_status: "not_found",
        matched: null,
        candidates: [],
      },
    ]);

  /** Wählt einen Kandidaten aus und lernt Alias. */
  const pickCandidate = async (item: EditableIngredient, cand: FoodMatch) => {
    updateItem(item.clientId, {
      matched: cand,
      match_status: "auto_matched",
      needs_confirmation: false,
      user_confirmed: true,
    });
    // Alias lernen: nur wenn AI etwas anderes vorgeschlagen hat als der Match-Name
    if (item.originalName && item.originalName.trim()) {
      try {
        await learnFn({ data: { term: item.originalName, food_id: cand.id } });
      } catch {
        /* Lernen ist Best-Effort */
      }
    }
  };

  /** Nach Namen-Änderung: neu matchen. */
  const rematchByName = async (item: EditableIngredient, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      updateItem(item.clientId, {
        name: newName,
        matched: null,
        candidates: [],
        match_status: "not_found",
      });
      return;
    }
    try {
      const r = await matchFn({ data: { name: trimmed } });
      updateItem(item.clientId, {
        name: newName,
        matched:
          r.match_status === "auto_matched" || r.match_status === "auto_matched_editable"
            ? r.best
            : null,
        candidates: r.candidates,
        match_status: r.match_status,
        needs_confirmation:
          r.match_status === "needs_choice" || r.match_status === "not_found",
      });
    } catch {
      /* still allow local edit */
    }
  };

  const runSearch = async (item: EditableIngredient, term: string) => {
    if (!term.trim()) return;
    try {
      const r = await matchFn({ data: { name: term } });
      updateItem(item.clientId, {
        candidates: r.candidates,
        match_status: r.candidates.length ? "needs_choice" : "not_found",
      });
    } catch {}
  };

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
      toast.success(
        `${valid.length} Zutat(en) zu ${SLOTS.find((s) => s.key === slot)?.label} gebucht`,
      );
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
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-secondary"
            aria-label="Schließen"
          >
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
                    Fotografiere die gesamte Mahlzeit möglichst von oben. Für bessere Ergebnisse
                    Teller, Beilagen und Getränke vollständig aufnehmen.
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
              {/* Info */}
              <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <span>
                  Kalorien &amp; Makros stammen aus der BodyFuel-Lebensmitteldatenbank. Zutaten
                  &amp; Mengen kurz prüfen und bei Rückfragen bestätigen.
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

              {/* AI-Rückfragen */}
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
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [i]: e.target.value }))
                        }
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

              {/* Zutatenliste */}
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

                {items.map((i) => (
                  <IngredientRow
                    key={i.clientId}
                    item={i}
                    onChangeName={(name) => updateItem(i.clientId, { name })}
                    onNameCommit={(name) => rematchByName(i, name)}
                    onChangeAmount={(v) =>
                      updateItem(i.clientId, { estimated_amount: Math.max(0, v) })
                    }
                    onChangeUnit={(unit) => updateItem(i.clientId, { unit })}
                    onRemove={() => removeItem(i.clientId)}
                    onPickCandidate={(c) => pickCandidate(i, c)}
                    onClear={() =>
                      updateItem(i.clientId, {
                        matched: null,
                        match_status: i.candidates.length ? "needs_choice" : "not_found",
                      })
                    }
                    searchTerm={searchTermByItem[i.clientId] ?? ""}
                    onSearchTerm={(t) =>
                      setSearchTermByItem((prev) => ({ ...prev, [i.clientId]: t }))
                    }
                    onSearch={() => runSearch(i, searchTermByItem[i.clientId] ?? i.name)}
                  />
                ))}
              </div>

              {/* Totals */}
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {unresolvedCount > 0 ? "Bisher berechnet" : "Summe (nach Portion)"}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="font-display text-2xl font-bold">{totals.kcal} kcal</div>
                  <div className="text-xs text-muted-foreground">
                    P {totals.protein} · K {totals.carbs} · F {totals.fat}
                  </div>
                </div>
                {unresolvedCount > 0 && matchedCount > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {unresolvedCount === 1
                      ? "Eine Zutat muss noch kurz bestätigt werden."
                      : `${unresolvedCount} Zutaten müssen noch kurz bestätigt werden.`}
                  </div>
                )}
              </div>

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
                      disabled={saving || matchedCount === 0}
                      onClick={() => trackToSlot(s.key)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={saveAsCustomMeal}
                  disabled={saving}
                >
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

// ────────────────────────────────────────────────────────────────────────────
// Zutaten-Zeile mit Inline-Kandidatenauswahl
// ────────────────────────────────────────────────────────────────────────────

function statusLabel(status: MatchStatus): { text: string; tone: "ok" | "info" | "warn" | "danger" } | null {
  switch (status) {
    case "auto_matched":
      return { text: "Automatisch zugeordnet", tone: "ok" };
    case "auto_matched_editable":
      return { text: "Automatisch – bitte kurz prüfen", tone: "info" };
    case "needs_choice":
      return { text: "Bitte kurz auswählen", tone: "warn" };
    case "not_found":
      return { text: "Lebensmittel nicht gefunden", tone: "danger" };
  }
}

function IngredientRow({
  item,
  onChangeName,
  onNameCommit,
  onChangeAmount,
  onChangeUnit,
  onRemove,
  onPickCandidate,
  onClear,
  searchTerm,
  onSearchTerm,
  onSearch,
}: {
  item: EditableIngredient;
  onChangeName: (n: string) => void;
  onNameCommit: (n: string) => void;
  onChangeAmount: (v: number) => void;
  onChangeUnit: (u: "g" | "ml" | "piece") => void;
  onRemove: () => void;
  onPickCandidate: (c: FoodMatch) => void;
  onClear: () => void;
  searchTerm: string;
  onSearchTerm: (t: string) => void;
  onSearch: () => void;
}) {
  const m = macrosFor(item);
  const status = statusLabel(item.match_status);
  const needsChoice = item.match_status === "needs_choice" || item.match_status === "not_found";
  const bg =
    needsChoice
      ? "border-border bg-background/40"
      : item.match_status === "auto_matched_editable"
      ? "border-gold/40 bg-gold/5"
      : "border-border bg-background/40";

  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      {/* Name + Trash */}
      <div className="mb-2 flex items-start gap-2">
        <Input
          value={item.name}
          onChange={(e) => onChangeName(e.target.value)}
          onBlur={(e) => onNameCommit(e.target.value)}
          className="text-sm font-medium"
        />
        <button
          onClick={onRemove}
          className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-warning"
          aria-label="Zutat entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Menge + Einheit */}
      <div className="grid grid-cols-[1fr_100px] gap-2">
        <Input
          type="number"
          inputMode="decimal"
          value={item.estimated_amount}
          onChange={(e) => onChangeAmount(Number(e.target.value) || 0)}
        />
        <select
          value={item.unit}
          onChange={(e) => onChangeUnit(e.target.value as "g" | "ml" | "piece")}
          className="rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="piece">Stück</option>
        </select>
      </div>

      {/* Match-Zeile: entweder Match anzeigen oder Auswahl */}
      {item.matched ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-secondary/40 px-2 py-1.5 text-[11px]">
          <div>
            <div className="text-foreground">
              <Check className="mr-1 inline h-3 w-3 text-emerald-500" />
              {item.matched.name}
              {item.matched.verified_by_coach && (
                <span className="ml-1 text-emerald-500">✓</span>
              )}
            </div>
            <div className="text-muted-foreground">
              {Math.round(m.kcal)} kcal · P {m.protein.toFixed(1)} · K {m.carbs.toFixed(1)} · F {m.fat.toFixed(1)}
              {status && status.tone !== "ok" && (
                <span className="ml-2 text-gold">· {status.text}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClear}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Ändern
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gold">
            <AlertTriangle className="h-3 w-3" />
            {status?.text ?? "Bitte kurz auswählen"}
          </div>
          {item.candidates.length > 0 ? (
            <div className="grid gap-1">
              {item.candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPickCandidate(c)}
                  className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1.5 text-left text-xs hover:border-gold/60"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {Math.round(c.kcal_per_100g)} kcal/100 · Score {(c.score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                value={searchTerm}
                onChange={(e) => onSearchTerm(e.target.value)}
                placeholder="Lebensmittel suchen (z.B. Süßkirschen)"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={onSearch}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

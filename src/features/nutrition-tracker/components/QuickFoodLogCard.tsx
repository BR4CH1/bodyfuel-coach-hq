import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, Loader2, Mic, Minus, Plus, Search, Sparkles, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { searchFoodsDb } from "@/lib/nutrition.functions";
import type { FoodResult } from "@/lib/nutrition.types";
import { commitFoodLog, correctFoodLog, discardFoodLog, parseFoodLog } from "@/lib/quick-food-log.functions";
import {
  applyAmountChange,
  applyFoodChange,
  isBlocking,
  macrosFor,
  sumMacros,
  type FoodRef,
  type QuickMeal,
  type ReviewItem,
} from "../lib/quick-food-log.logic";
import { parseFoodAmount, todayIso } from "../lib/nutrition-tracker.logic";
import { recordWav } from "../lib/record-wav";
import type { NutritionTargets, NutritionTotals } from "../types";

const MEAL_LABEL: Record<QuickMeal, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snacks",
};
const MEAL_ORDER: QuickMeal[] = ["breakfast", "lunch", "dinner", "snack"];
const DRAFT_KEY = "bf-quicklog-text";
const MAX_RECORD_MS = 120_000;

function toRef(f: FoodResult): FoodRef {
  return {
    food_id: f.source === "manual" ? null : (f.id ?? null),
    name: f.name,
    brand: f.brand ?? null,
    unit: f.unit === "ml" ? "ml" : "g",
    kcal_per_100g: Number(f.kcal_per_100g) || 0,
    protein_per_100g: Number(f.protein_per_100g) || 0,
    carbs_per_100g: Number(f.carbs_per_100g) || 0,
    fat_per_100g: Number(f.fat_per_100g) || 0,
    serving_g: f.serving_g ?? null,
    source: String(f.source ?? "manual"),
    verified: !!f.verified_by_coach,
  };
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y?.slice(2)}`;
}

export function QuickFoodLogCard({
  date,
  targets,
  totals,
  onTracked,
}: {
  date: string;
  targets: NutritionTargets;
  totals: NutritionTotals;
  onTracked: () => void | Promise<void>;
}) {
  const parseFn = useServerFn(parseFoodLog);
  const correctFn = useServerFn(correctFoodLog);
  const commitFn = useServerFn(commitFoodLog);
  const discardFn = useServerFn(discardFoodLog);
  const searchFn = useServerFn(searchFoodsDb);

  const [text, setText] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [parsing, setParsing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [dateAdjusted, setDateAdjusted] = useState(false);
  const [correction, setCorrection] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [swapKey, setSwapKey] = useState<string | null>(null);

  // Aufnahme
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const recRef = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline-/Reload-Schutz: Text lokal merken
  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (saved) setText(saved);
  }, []);
  useEffect(() => {
    if (text) window.localStorage.setItem(DRAFT_KEY, text);
    else window.localStorage.removeItem(DRAFT_KEY);
  }, [text]);
  useEffect(() => () => recRef.current?.cancel(), []);

  const reviewTotals = useMemo(() => sumMacros(items.filter((i) => i.entry_date === date)), [items, date]);
  const blocking = items.filter(isBlocking).length;
  const otherDates = [...new Set(items.map((i) => i.entry_date).filter((d) => d !== date))];

  async function analyze() {
    if (text.trim().length < 2) return;
    setParsing(true);
    try {
      const res = await parseFn({ data: { text: text.trim(), date, today: todayIso(), input_mode: inputMode } });
      if (res.empty) {
        toast.info("Ich habe keine Lebensmittel erkannt – beschreib kurz, was du gegessen hast.");
        return;
      }
      setDraftId(res.draftId);
      setItems(res.items);
      setDateAdjusted(res.dateAdjusted);
      setAmountDrafts({});
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Mikrofon wird hier nicht unterstützt – bitte tippen.");
      return;
    }
    try {
      recRef.current = await recordWav((l) => setLevel(l));
      setRecording(true);
      timerRef.current = setTimeout(() => void stopRecording(), MAX_RECORD_MS);
    } catch {
      toast.error("Kein Mikrofonzugriff – bitte Freigabe prüfen oder tippen.");
    }
  }

  async function stopRecording() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    setLevel(0);
    if (!rec) return;
    setTranscribing(true);
    try {
      const file = await rec.stop();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte erneut einloggen.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || "Transkription fehlgeschlagen");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let live = "";
      let finalText: string | null = null;
      const prefix = text.trim() ? `${text.trim()} ` : "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "transcript.text.delta") {
              live += evt.delta ?? "";
              setText(prefix + live);
            } else if (evt.type === "transcript.text.done") finalText = String(evt.text ?? live);
            else if (evt.type === "error") throw new Error("Transkription fehlgeschlagen");
          } catch (err) {
            if ((err as Error).message === "Transkription fehlgeschlagen") throw err;
          }
        }
      }
      const out = (finalText ?? live).trim();
      if (!out) throw new Error("Nichts verstanden – bitte nochmal oder tippen.");
      setText(prefix + out);
      setInputMode("voice");
      toast.success("Text erkannt – bitte kurz prüfen und dann analysieren.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  }

  function updateItem(key: string, fn: (it: ReviewItem) => ReviewItem) {
    setItems((cur) => cur.map((it) => (it.key === key ? fn(it) : it)));
  }

  function setAmount(key: string, raw: string) {
    setAmountDrafts((d) => ({ ...d, [key]: raw }));
    const n = parseFoodAmount(raw);
    if (n > 0) updateItem(key, (it) => applyAmountChange(it, n));
  }

  function stepAmount(it: ReviewItem, dir: 1 | -1) {
    const step = it.amount >= 200 ? 25 : 10;
    setAmountDrafts((d) => {
      const { [it.key]: _omit, ...rest } = d;
      return rest;
    });
    updateItem(it.key, (x) => applyAmountChange(x, Math.max(step, x.amount + dir * step)));
  }

  async function applyCorrection() {
    if (!draftId || correction.trim().length < 2) return;
    setCorrecting(true);
    try {
      const res = await correctFn({ data: { draftId, correction: correction.trim(), items } });
      setItems(res.items);
      setAmountDrafts({});
      setCorrection("");
      toast.success(res.changed ? "Korrektur übernommen." : "Keine passende Position gefunden.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCorrecting(false);
    }
  }

  async function commit() {
    if (!draftId || committing || blocking > 0 || items.length === 0) return;
    setCommitting(true);
    try {
      const res = await commitFn({
        data: {
          draftId,
          items: items.map((i) => ({
            key: i.key,
            entry_date: i.entry_date,
            meal: i.meal,
            amount: i.amount,
            unit: i.unit,
            label: i.label,
            phrase: i.phrase,
            estimate_level: i.estimate_level,
            food: i.food
              ? {
                  food_id: i.food.food_id,
                  name: i.food.name,
                  brand: i.food.brand,
                  unit: i.food.unit,
                  kcal_per_100g: Math.min(1000, i.food.kcal_per_100g),
                  protein_per_100g: Math.min(100, i.food.protein_per_100g),
                  carbs_per_100g: Math.min(100, i.food.carbs_per_100g),
                  fat_per_100g: Math.min(100, i.food.fat_per_100g),
                  source: i.food.source.slice(0, 40),
                }
              : null,
          })),
        },
      });
      toast.success(
        res.alreadyCommitted ? "Bereits getrackt – nichts doppelt gespeichert." : `${res.inserted} Einträge getrackt.`,
      );
      reset(false);
      await onTracked();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function reset(discard = true) {
    if (discard && draftId) void discardFn({ data: { draftId } }).catch(() => undefined);
    setDraftId(null);
    setItems([]);
    setText("");
    setCorrection("");
    setInputMode("text");
    setSwapKey(null);
  }

  const busy = parsing || transcribing || recording;

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-bold">Schnell eintragen</h2>
      </div>

      {!draftId ? (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="z. B. morgens Protein-Grießpudding von Lidl, mittags Schnitzel mit Bratkartoffeln, später 5 Reiswaffeln mit 100 g Erdnussbutter und 700 ml O-Saft"
            rows={3}
            maxLength={2000}
            disabled={recording || transcribing}
            className="min-h-[88px] text-base"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={recording ? () => void stopRecording() : () => void startRecording()}
              disabled={parsing || transcribing}
              aria-label={recording ? "Aufnahme beenden" : "Sprachaufnahme starten"}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            {recording && (
              <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="bg-primary transition-all" style={{ width: `${Math.min(100, level * 180)}%` }} />
              </div>
            )}
            {!recording && (
              <Button
                type="button"
                className="h-11 flex-1"
                onClick={() => void analyze()}
                disabled={busy || text.trim().length < 2}
              >
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analysieren
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {recording
              ? "Aufnahme läuft … (max. 2 Minuten). Tippe auf Stopp, wenn du fertig bist."
              : "Schreib oder sprich einfach drauflos. Du prüfst alles, bevor etwas gespeichert wird. Sprachaufnahmen werden nicht gespeichert."}
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs italic text-muted-foreground">„{text}"</p>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => reset()} aria-label="Verwerfen">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {(dateAdjusted || otherDates.length > 0) && (
            <div className="rounded-lg border border-border bg-muted/50 p-2 text-xs">
              {otherDates.length > 0 && <>Einträge für {otherDates.map(fmtDate).join(", ")} werden dort gespeichert. </>}
              {dateAdjusted && <>Datum wurde auf den erlaubten Zeitraum (max. 7 Tage zurück) begrenzt.</>}
            </div>
          )}

          {MEAL_ORDER.map((meal) => {
            const group = items.filter((i) => i.meal === meal);
            if (!group.length) return null;
            return (
              <div key={meal}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{MEAL_LABEL[meal]}</h3>
                <ul className="space-y-2">
                  {group.map((it) => (
                    <ReviewRow
                      key={it.key}
                      item={it}
                      mainDate={date}
                      amountDraft={amountDrafts[it.key]}
                      onAmount={(raw) => setAmount(it.key, raw)}
                      onStep={(dir) => stepAmount(it, dir)}
                      onMeal={(m) => updateItem(it.key, (x) => ({ ...x, meal: m }))}
                      onRemove={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}
                      onConfirm={() => updateItem(it.key, (x) => ({ ...x, confirmed: true }))}
                      swapping={swapKey === it.key}
                      onToggleSwap={() => setSwapKey((k) => (k === it.key ? null : it.key))}
                      onSwap={(f) => {
                        updateItem(it.key, (x) => applyFoodChange(x, toRef(f)));
                        setSwapKey(null);
                      }}
                      search={(q) => searchFn({ data: { query: q, limit: 8 } })}
                    />
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Neu für {fmtDate(date)}</span>
              <span className="font-display text-lg font-bold">{Math.round(reviewTotals.kcal)} kcal</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              P {Math.round(reviewTotals.protein_g)} g · KH {Math.round(reviewTotals.carbs_g)} g · F {Math.round(reviewTotals.fat_g)} g
            </div>
            <ProgressLine label="kcal" before={totals.kcal} add={reviewTotals.kcal} target={targets.kcal} />
            <ProgressLine label="Protein" before={totals.protein_g} add={reviewTotals.protein_g} target={targets.protein_g} unit="g" />
          </div>

          <div className="flex gap-2">
            <Input
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Korrektur, z. B. „Erdnussbutter waren eher 70 g“"
              className="h-11 text-base"
              onKeyDown={(e) => e.key === "Enter" && void applyCorrection()}
            />
            <Button variant="outline" className="h-11" onClick={() => void applyCorrection()} disabled={correcting || correction.trim().length < 2}>
              {correcting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ändern"}
            </Button>
          </div>

          {blocking > 0 && (
            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {blocking} unsichere Position(en): bitte bestätigen, tauschen oder entfernen.
            </p>
          )}
          <Button className="h-12 w-full text-base" onClick={() => void commit()} disabled={committing || blocking > 0 || items.length === 0}>
            {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Tracken
          </Button>
        </div>
      )}
    </section>
  );
}

function ProgressLine({ label, before, add, target, unit = "" }: { label: string; before: number; add: number; target: number; unit?: string }) {
  const t = Math.max(1, target);
  const b = Math.min(100, (before / t) * 100);
  const a = Math.min(100 - b, (add / t) * 100);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span>
          {Math.round(before)} → <strong className="text-foreground">{Math.round(before + add)}</strong> / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-background">
        <div className="bg-muted-foreground/40" style={{ width: `${b}%` }} />
        <div className="bg-primary" style={{ width: `${a}%` }} />
      </div>
    </div>
  );
}

function ReviewRow({
  item,
  mainDate,
  amountDraft,
  onAmount,
  onStep,
  onMeal,
  onRemove,
  onConfirm,
  swapping,
  onToggleSwap,
  onSwap,
  search,
}: {
  item: ReviewItem;
  mainDate: string;
  amountDraft: string | undefined;
  onAmount: (raw: string) => void;
  onStep: (dir: 1 | -1) => void;
  onMeal: (m: QuickMeal) => void;
  onRemove: () => void;
  onConfirm: () => void;
  swapping: boolean;
  onToggleSwap: () => void;
  onSwap: (f: FoodResult) => void;
  search: (q: string) => Promise<FoodResult[]>;
}) {
  const m = macrosFor(item.food, item.amount);
  const tone =
    item.confidence === "low" && !item.confirmed
      ? "border-destructive/60 bg-destructive/5"
      : item.confidence === "high"
        ? "border-border"
        : "border-accent bg-accent/10";
  return (
    <li className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold">{item.label}</div>
          <div className="text-[11px] text-muted-foreground">
            „{item.phrase}"{item.entry_date !== mainDate ? ` · ${fmtDate(item.entry_date)}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold">{Math.round(m.kcal)} kcal</div>
          <div className="text-[10px] text-muted-foreground">
            P{Math.round(m.protein_g)} K{Math.round(m.carbs_g)} F{Math.round(m.fat_g)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        {item.confidence === "high" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
            <CheckCircle2 className="h-3 w-3" /> {item.estimate_level === "exact" ? "Etikett/geprüft" : "Katalog"}
          </span>
        ) : item.confidence === "medium" ? (
          <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">≈ geschätzt</span>
        ) : (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">
            {item.confirmed ? "bestätigt" : "unsicher"}
          </span>
        )}
        {item.warnings.map((w) => (
          <span key={w} className="text-muted-foreground">· {w}</span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onStep(-1)} aria-label="Weniger">
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          inputMode="decimal"
          value={amountDraft ?? String(item.amount).replace(".", ",")}
          onChange={(e) => onAmount(e.target.value)}
          className="h-10 w-20 text-center text-base"
          aria-label="Menge"
        />
        <span className="w-6 text-xs text-muted-foreground">{item.unit}</span>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onStep(1)} aria-label="Mehr">
          <Plus className="h-4 w-4" />
        </Button>
        {item.amount_note && <span className="text-[11px] text-muted-foreground">({item.amount_note})</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={item.meal}
          onChange={(e) => onMeal(e.target.value as QuickMeal)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Mahlzeit"
        >
          {MEAL_ORDER.map((mm) => (
            <option key={mm} value={mm}>{MEAL_LABEL[mm]}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="h-9" onClick={onToggleSwap}>
          <Search className="mr-1 h-3.5 w-3.5" /> Produkt
        </Button>
        {item.confidence === "low" && !item.confirmed && item.food && (
          <Button variant="outline" size="sm" className="h-9" onClick={onConfirm}>
            <Check className="mr-1 h-3.5 w-3.5" /> Passt
          </Button>
        )}
        <Button variant="ghost" size="icon" className="ml-auto h-9 w-9" onClick={onRemove} aria-label="Entfernen">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {swapping && <SwapSearch initial={item.food?.name ?? item.label} search={search} onPick={onSwap} />}
    </li>
  );
}

function SwapSearch({ initial, search, onPick }: { initial: string; search: (q: string) => Promise<FoodResult[]>; onPick: (f: FoodResult) => void }) {
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoodResult[]>([]);
  async function run() {
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      setResults(await search(q.trim()));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mt-2 rounded-lg border border-border bg-background p-2">
      <div className="flex gap-1.5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void run()} className="h-10 text-base" />
        <Button variant="outline" className="h-10" onClick={() => void run()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {results.map((f, i) => (
          <li key={`${f.id ?? f.name}-${i}`}>
            <button type="button" className="flex w-full justify-between gap-2 rounded px-2 py-2 text-left text-xs hover:bg-muted" onClick={() => onPick(f)}>
              <span className="min-w-0 break-words">
                {f.name}
                {f.brand ? <span className="text-muted-foreground"> · {f.brand}</span> : null}
              </span>
              <span className="shrink-0 text-muted-foreground">{Math.round(f.kcal_per_100g)} kcal/100{f.unit}</span>
            </button>
          </li>
        ))}
        {!loading && results.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Keine Treffer.</li>}
      </ul>
    </div>
  );
}

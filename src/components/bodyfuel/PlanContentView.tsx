import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Utensils, Dumbbell, Check, Shuffle, BookOpen, Repeat, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { parseNutritionPlan, estimateMealMacros } from "@/lib/nutrition-plan.functions";
import { parseTrainingPlan } from "@/lib/training.functions";
import { getDayType } from "@/lib/nutrition.functions";
import { logInteraction } from "@/lib/meal-feedback.functions";
import { getMySkipsForDate, removeMealSkip } from "@/lib/meal-skips.functions";
import { RecipeDialog } from "./RecipeDialog";
import { MealSwapDialog } from "./MealSwapDialog";
import { SkipReasonDialog } from "./SkipReasonDialog";

type Plan = { id: string; client_id: string; title: string; weeks_count?: number | null; scheduled_start_date?: string | null };
type Day = { id: string; name: string; sort_order: number; week_number?: number | null };
type Meal = {
  id: string;
  day_id: string;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sort_order: number;
};
type Exercise = {
  id: string;
  day_id: string;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weights: string | null;
  notes: string | null;
  sort_order: number;
};

type Props = {
  clientId: string;
  planType: "nutrition" | "training";
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const mealSlot = (idx: number, total: number): "breakfast" | "lunch" | "dinner" | "snack" => {
  if (idx === 0) return "breakfast";
  if (idx === total - 1 && total > 1) return "dinner";
  if (idx === 1 && total > 2) return "lunch";
  return "snack";
};
const slotFromName = (name: string): "breakfast" | "lunch" | "dinner" | "snack" | null => {
  const n = name.toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n)) return "breakfast";
  if (/mittag|lunch/.test(n)) return "lunch";
  if (/abend|dinner|sp(ä|a)t/.test(n)) return "dinner";
  if (/snack|shake|pre[- ]?workout|post[- ]?workout|zwischen/.test(n)) return "snack";
  return null;
};
const isRestDay = (name: string) => /rest|ruh|pause|off|frei/i.test(name);
const pickRandom = <T,>(arr: T[]): T | null =>
  arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

const INSTRUCTION_SIGNALS = [
  "Alles", "Zubereitung", "Zubereiten", "Anleitung", "Zusammen", "Mischen",
  "Kochen", "Backen", "Braten", "Garen", "Dünsten", "Dämpfen", "Grillen",
  "Zubereitungs", "Vorbereitung", "Vorbereiten", "Schneiden", "Würfeln",
  "Rühren", "Unterheben", "Vermengen", "Zusammenfügen", "In eine", "In den",
  "In die", "Auf dem", "Im Ofen", "Aufwärmen", "Erhitzen", "Abkühlen",
  "Kaltstellen", "Kühlschrank", "Über Nacht", "Mindestens", "Ca.", "Ca ",
  "Min.", "Minuten", "Stunden", "Lassen", "Kühl", "Warm", "Heiß",
  "Pfanne", "Topf", "Schüssel", "Ofen", "Herd", "Mikrowelle", "Dampfgarer",
  "Grill", "Mixen", "Pürieren", "Aufschlagen", "Verrühren",
];

function cleanDescription(desc: string | null): string | null {
  if (!desc) return null;
  const sentences = desc.split(/(?<=[.!?])\s+/);
  for (let i = 0; i < sentences.length; i++) {
    const t = sentences[i].trim();
    if (INSTRUCTION_SIGNALS.some((s) => t.toLowerCase().startsWith(s.toLowerCase()))) {
      const kept = sentences.slice(0, i).join(" ").trim();
      return kept || desc;
    }
  }
  return desc;
}

// Leite aus einem Mahlzeit-Namen einen "Tag-Gruppen-Schlüssel" ab.
// Beispiele:
//   "Trainingstag A Mahlzeit 1" -> { group: "Trainingstag A", label: "Mahlzeit 1" }
//   "Restday Mahlzeit 2"        -> { group: "Restday",       label: "Mahlzeit 2" }
//   "Frühstück"                  -> null  (keine Tag-Info im Namen)
function extractDayGroup(name: string): { group: string; label: string } | null {
  const m = name.match(
    /^\s*(Trainingstag(?:\s+[A-Za-z0-9]+)?|Restday(?:\s+[A-Za-z0-9]+)?|Ruhetag(?:\s+[A-Za-z0-9]+)?|Pausentag(?:\s+[A-Za-z0-9]+)?|Tag\s*\d+|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b[\s\-–—:|·]*(.*)$/i,
  );
  if (!m) return null;
  const group = m[1].replace(/\s+/g, " ").trim();
  const rest = (m[2] ?? "").trim();
  return { group, label: rest || group };
}

type VirtualDay = { id: string; name: string; realDayId: string };

type DayLike = { id: string; name: string; sort_order: number };
type ItemLike = { id: string; day_id: string; name: string; sort_order: number };

function buildVirtualDays<T extends ItemLike>(days: DayLike[], items: T[]): {
  virtualDays: VirtualDay[];
  itemToVirtual: Record<string, string>;
  itemDisplayName: Record<string, string>;
} {
  const virtualDays: VirtualDay[] = [];
  const itemToVirtual: Record<string, string> = {};
  const itemDisplayName: Record<string, string> = {};

  for (const day of days) {
    const dayItems = items
      .filter((m) => m.day_id === day.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const groups = new Map<string, { items: T[]; firstIndex: number }>();
    let allHaveGroup = dayItems.length > 0;
    dayItems.forEach((m, idx) => {
      const g = extractDayGroup(m.name);
      if (!g) { allHaveGroup = false; return; }
      const key = g.group;
      if (!groups.has(key)) groups.set(key, { items: [], firstIndex: idx });
      groups.get(key)!.items.push(m);
      itemDisplayName[m.id] = g.label;
    });

    if (allHaveGroup && groups.size > 1) {
      const sorted = [...groups.entries()].sort(
        (a, b) => a[1].firstIndex - b[1].firstIndex,
      );
      for (const [groupName, info] of sorted) {
        const vid = `${day.id}::${groupName}`;
        virtualDays.push({ id: vid, name: groupName, realDayId: day.id });
        info.items.forEach((m) => { itemToVirtual[m.id] = vid; });
      }
    } else {
      virtualDays.push({ id: day.id, name: day.name, realDayId: day.id });
      dayItems.forEach((m) => {
        itemToVirtual[m.id] = day.id;
        if (!itemDisplayName[m.id]) itemDisplayName[m.id] = m.name;
      });
    }
  }
  return { virtualDays, itemToVirtual, itemDisplayName };
}

export function PlanContentView({ clientId, planType }: Props) {
  const { isCoach, supabaseUser } = useSession();
  const parseNutrition = useServerFn(parseNutritionPlan);
  const parseTraining = useServerFn(parseTrainingPlan);
  const getDayTypeFn = useServerFn(getDayType);
  const estimateMacros = useServerFn(estimateMealMacros);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeDay, setActiveDay] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [tracked, setTracked] = useState<Record<string, string>>({}); // meal_id -> food_entry.id
  const [togglingId, setTogglingId] = useState<string>("");
  const [dayKind, setDayKind] = useState<"training" | "rest" | null>(null);
  const [recipeMeal, setRecipeMeal] = useState<Meal | null>(null);
  const [swapMeal, setSwapMeal] = useState<Meal | null>(null);
  const [skipMeal, setSkipMeal] = useState<Meal | null>(null);
  const [skipped, setSkipped] = useState<Record<string, string>>({}); // meal_id -> reason
  const logFn = useServerFn(logInteraction);
  const getSkipsFn = useServerFn(getMySkipsForDate);
  const removeSkipFn = useServerFn(removeMealSkip);


  const dayTable = planType === "nutrition" ? "nutrition_plan_days" : "training_days";
  const itemTable = planType === "nutrition" ? "nutrition_plan_meals" : "training_exercises";

  const isSelf = !!supabaseUser && supabaseUser.id === clientId && !isCoach;
  const canTrack = planType === "nutrition" && isSelf;
  const pickStorageKey = `bf:plan:${planType}:${clientId}:${todayKey()}`;

  // Virtuelle Tage: splittet einen echten "Day" anhand der Item-Namen
  // (z.B. "Trainingstag A Mahlzeit 1") in mehrere Dropdown-Einträge auf.
  const { virtualDays, itemToVirtual, itemDisplayName } = useMemo(() => {
    const items: ItemLike[] = planType === "nutrition" ? meals : exercises;
    return buildVirtualDays(days, items);
  }, [days, meals, exercises, planType]);

  const reload = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data: planRow } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, title, weeks_count, scheduled_start_date")
      .eq("client_id", clientId)
      .eq("plan_type", planType)
      .eq("is_active", true)
      .maybeSingle();
    setPlan((planRow as Plan) ?? null);

    if (!planRow) {
      setDays([]); setMeals([]); setExercises([]); setLoading(false); return;
    }
    const { data: dayRows } = await supabase
      .from(dayTable)
      .select("*")
      .eq("plan_id", planRow.id)
      .order("sort_order");
    let dayList = (dayRows as Day[]) ?? [];
    // For multi-week training plans, only expose the current week's days in the dropdown.
    if (planType === "training") {
      const wc = (planRow as any).weeks_count ?? 1;
      const start = (planRow as any).scheduled_start_date
        ? new Date((planRow as any).scheduled_start_date)
        : null;
      let activeWeek = 1;
      if (start && wc > 1) {
        const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
        activeWeek = Math.min(wc, Math.max(1, Math.floor(diffDays / 7) + 1));
      }
      // Derive week_number from sort_order when the column is missing so that
      // plans created before the week_number field still split correctly.
      const withWeek = dayList.map((d) => ({
        ...d,
        week_number: d.week_number ?? Math.floor((d.sort_order - 1) / 7) + 1,
      }));
      const filtered = withWeek.filter((d) => d.week_number === activeWeek);
      // Always restrict to the current week (fallback to week 1 if nothing matches)
      dayList = filtered.length ? filtered : withWeek.filter((d) => d.week_number === 1);
    }
    setDays(dayList);

    if (dayList.length) {
      const { data: itemRows } = await supabase
        .from(itemTable)
        .select("*")
        .in("day_id", dayList.map((d) => d.id))
        .order("sort_order");
      if (planType === "nutrition") setMeals((itemRows as Meal[]) ?? []);
      else setExercises((itemRows as Exercise[]) ?? []);
    } else {
      setMeals([]); setExercises([]);
    }
    setLoading(false);
  };

  const reloadTracked = async () => {
    if (!canTrack) { setTracked({}); return; }
    const { data } = await supabase
      .from("food_entries")
      .select("id, source")
      .eq("user_id", clientId)
      .eq("entry_date", todayKey())
      .like("source", "plan:%");
    const map: Record<string, string> = {};
    ((data as { id: string; source: string }[]) ?? []).forEach((r) => {
      const mealId = r.source.slice("plan:".length);
      map[mealId] = r.id;
    });
    setTracked(map);
  };

  const reloadSkips = async () => {
    if (!canTrack) { setSkipped({}); return; }
    try {
      const res = await getSkipsFn({ data: { skip_date: todayKey() } });
      const map: Record<string, string> = {};
      (res.items ?? []).forEach((s: any) => { if (s.meal_id) map[s.meal_id] = s.reason; });
      setSkipped(map);
    } catch {}
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId, planType]);
  useEffect(() => { reloadTracked(); reloadSkips(); /* eslint-disable-next-line */ }, [clientId, planType, supabaseUser?.id]);

  // Fetch today's day type (only for self / nutrition); used to auto-pick a matching day.
  useEffect(() => {
    if (!isSelf || planType !== "nutrition") { setDayKind(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await getDayTypeFn({ data: { user_id: clientId, date: todayKey() } });
        if (!cancelled) setDayKind(d.kind);
      } catch {
        if (!cancelled) setDayKind(null);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, planType, isSelf, getDayTypeFn]);

  // Auto-pick a matching virtual day for today; respect saved manual pick.
  useEffect(() => {
    if (!virtualDays.length) return;
    let saved = "";
    try { saved = localStorage.getItem(pickStorageKey) ?? ""; } catch {}
    if (saved && virtualDays.find((d) => d.id === saved)) {
      setActiveDay((cur) => (cur === saved ? cur : saved));
      return;
    }
    if (activeDay && virtualDays.find((d) => d.id === activeDay)) return;
    const matches = dayKind
      ? virtualDays.filter((d) =>
          dayKind === "rest" ? isRestDay(d.name) : !isRestDay(d.name),
        )
      : [];
    const pool = matches.length ? matches : virtualDays;
    const pick = pickRandom(pool) ?? virtualDays[0];
    if (pick) setActiveDay(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualDays, dayKind]);

  // Notify the Training Tracker (separate component on the /training page) so
  // it auto-expands the matching day section when the user picks one above.
  useEffect(() => {
    if (planType !== "training" || !activeDay) return;
    const vd = virtualDays.find((d) => d.id === activeDay);
    const name = vd?.name;
    if (!name) return;
    const key = `bf:training:active-day-name:${clientId}`;
    try { localStorage.setItem(key, name); } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent("bf:training-active-day", { detail: { clientId, name } }),
      );
    } catch {}
  }, [planType, activeDay, virtualDays, clientId]);

  const pickAnotherDay = () => {
    if (!virtualDays.length) return;
    const matches = virtualDays.filter((d) =>
      dayKind === "rest" ? isRestDay(d.name) : !isRestDay(d.name),
    );
    const pool = (matches.length ? matches : virtualDays).filter((d) => d.id !== activeDay);
    const pick = pickRandom(pool.length ? pool : virtualDays);
    if (pick) {
      setActiveDay(pick.id);
      try { localStorage.setItem(pickStorageKey, pick.id); } catch {}
    }
  };


  const handleParse = async () => {
    if (!plan) return;
    setParsing(true);
    try {
      const fn = planType === "nutrition" ? parseNutrition : parseTraining;
      const res = await fn({ data: { plan_id: plan.id } }) as { days: number; meals?: number; exercises?: number };
      toast.success(
        planType === "nutrition"
          ? `${res.days} Tage · ${res.meals ?? 0} Mahlzeiten gelesen`
          : `${res.days} Tage · ${res.exercises ?? 0} Übungen gelesen`,
      );
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Lesen fehlgeschlagen");
    } finally {
      setParsing(false);
    }
  };

  const toggleMeal = async (m: Meal) => {
    if (!canTrack) return;
    setTogglingId(m.id);
    try {
      const existing = tracked[m.id];
      if (existing) {
        const { error } = await supabase.from("food_entries").delete().eq("id", existing);
        if (error) throw error;
        setTracked((t) => { const n = { ...t }; delete n[m.id]; return n; });
        toast.success(`${m.name} entfernt`);
      } else {
        const meta = extractDayGroup(m.name);
        const dayMealsAll = meals
          .filter((x) => x.day_id === m.day_id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const dayMeals = meta
          ? dayMealsAll.filter((x) => {
              const g = extractDayGroup(x.name);
              return g && g.group.toLowerCase() === meta.group.toLowerCase();
            })
          : dayMealsAll;
        const list = dayMeals.length ? dayMeals : dayMealsAll;
        let idx = list.findIndex((x) => x.id === m.id);
        // Prefer "Mahlzeit N" number from the name when present
        const mn = m.name.match(/Mahlzeit\s*(\d+)/i);
        if (mn) idx = Math.max(0, parseInt(mn[1], 10) - 1);
        const slot = slotFromName(m.name) ?? slotFromName(itemDisplayName[m.id] ?? "") ?? mealSlot(idx, list.length);

        let kcal = m.kcal ?? 0;
        let p = m.protein_g ?? 0;
        let c = m.carbs_g ?? 0;
        let f = m.fat_g ?? 0;
        if (!kcal && !p && !c && !f) {
          try {
            const est = await estimateMacros({ data: { meal_id: m.id } });
            kcal = est.kcal; p = est.protein_g; c = est.carbs_g; f = est.fat_g;
            setMeals((arr) => arr.map((x) => x.id === m.id ? { ...x, kcal, protein_g: p, carbs_g: c, fat_g: f } : x));
          } catch (e: any) {
            toast.error("Nährwerte konnten nicht geschätzt werden");
            return;
          }
        }
        // Fallback: derive kcal from macros if missing (Atwater: 4/4/9)
        if (!kcal && (p || c || f)) {
          kcal = Math.round(p * 4 + c * 4 + f * 9);
        }

        const { data, error } = await supabase
          .from("food_entries")
          .insert({
            user_id: clientId,
            entry_date: todayKey(),
            meal: slot,
            name: m.name + (m.description ? ` — ${m.description}` : ""),
            serving_g: 100,
            kcal,
            protein_g: p,
            carbs_g: c,
            fat_g: f,
            source: `plan:${m.id}`,
          })
          .select("id")
          .single();
        if (error) throw error;
        setTracked((t) => ({ ...t, [m.id]: (data as { id: string }).id }));
        toast.success(`${m.name} getrackt`);
        try { await logFn({ data: { meal_id: m.id, kind: "eaten" } }); } catch {}
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Tracken fehlgeschlagen");
    } finally {
      setTogglingId("");
    }
  };

  if (!plan) return null;
  if (loading) return <div className="text-sm text-muted-foreground">Lade Inhalte…</div>;

  const Icon = planType === "nutrition" ? Utensils : Dumbbell;
  const eyebrow = planType === "nutrition" ? "Ernährungsplan" : "Trainingsplan";
  const empty = planType === "nutrition" ? "Mahlzeiten" : "Übungen";

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-gold">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</div>
            <div className="font-display text-base font-bold">Inhalt</div>
          </div>
        </div>
        {isCoach && (
          <button
            onClick={handleParse}
            disabled={parsing}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-accent/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-accent/50 disabled:opacity-60"
          >
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {days.length ? "Neu aus PDF lesen" : "Aus PDF lesen"}
          </button>
        )}
      </div>

      {!days.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {isCoach
            ? "Noch nicht extrahiert — klicke ‚Aus PDF lesen‘, um die Inhalte des aktuellen Plans zu übernehmen."
            : "Dein Coach hat die Inhalte noch nicht freigeschaltet — du kannst den Plan jederzeit als PDF herunterladen."}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                {isSelf && dayKind
                  ? dayKind === "rest" ? "Heute: Restday" : "Heute: Trainingstag"
                  : "Tag wählen"}
              </label>
              {isSelf && planType === "nutrition" && virtualDays.length > 1 && (
                <button
                  onClick={pickAnotherDay}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-gold"
                >
                  <Shuffle className="h-3 w-3" /> Anderen Tag
                </button>
              )}
            </div>
            <select
              value={activeDay}
              onChange={(e) => {
                setActiveDay(e.target.value);
                try { localStorage.setItem(pickStorageKey, e.target.value); } catch {}
              }}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {virtualDays.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>


          {canTrack && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tippe eine Mahlzeit an, um sie für heute zu tracken.
            </p>
          )}

          <div className="mt-3 space-y-3">
            {planType === "nutrition"
              ? meals.filter((m) => itemToVirtual[m.id] === activeDay).map((m) => {
                  const isTracked = !!tracked[m.id];
                  const busy = togglingId === m.id;
                  const displayName = itemDisplayName[m.id] ?? m.name;
                  const inner = (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-gold">{displayName}</div>
                        {canTrack && isTracked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <Check className="h-3 w-3" /> getrackt
                          </span>
                        )}
                      </div>
                      {(() => {
                        const text = cleanDescription(m.description);
                        if (!text) return null;
                        return <p className="mt-1 text-sm text-foreground/90">{text}</p>;
                      })()}
                      {(m.protein_g != null || m.carbs_g != null || m.fat_g != null || m.kcal != null) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          {m.kcal != null && <span>{m.kcal} kcal</span>}
                          {m.protein_g != null && <span>P {m.protein_g}g</span>}
                          {m.carbs_g != null && <span>· KH {m.carbs_g}g</span>}
                          {m.fat_g != null && <span>· F {m.fat_g}g</span>}
                        </div>
                      )}
                    </>
                  );
                  const base = "rounded-2xl border p-4 transition";
                  const isSkipped = !!skipped[m.id];
                  const style = isTracked
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : isSkipped
                      ? "border-amber-500/40 bg-amber-500/5 opacity-80"
                      : "border-border bg-background/40";
                  return (
                    <div key={m.id} className={`${base} ${style} relative`}>
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {canTrack && m.kcal && m.protein_g && m.carbs_g && m.fat_g && (
                          <button
                            type="button"
                            onClick={() => setSwapMeal(m)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-gold/50 hover:text-gold"
                            aria-label="Mahlzeit tauschen"
                            title="Smart-Vorschläge (±5 % Makros)"
                          >
                            <Repeat className="h-3 w-3" /> Tausch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRecipeMeal(m)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-gold/50 hover:text-gold"
                          aria-label="Rezept anzeigen"
                        >
                          <BookOpen className="h-3 w-3" /> Rezept
                        </button>
                      </div>
                      {canTrack ? (
                        <button
                          type="button"
                          onClick={() => toggleMeal(m)}
                          disabled={busy}
                          className="block w-full pr-32 text-left hover:opacity-90 disabled:opacity-60"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="pr-32">{inner}</div>
                      )}
                    </div>
                  );
                })
              : exercises.filter((e) => itemToVirtual[e.id] === activeDay).map((e) => {
                  const reps = (e.target_reps ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                  const weights = (e.target_weights ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                  const exName = itemDisplayName[e.id] ?? e.name;
                  const isNonExercise = /rest|ruh|pause|frei|mobility|foam|dehn|stretch|recovery|spiel|game|training bei|mannschaft/i.test(exName);
                  const demoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exName + " Übung Ausführung")}`;
                  return (
                    <div key={e.id} className="rounded-2xl border border-border bg-background/40 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-semibold">{exName}</div>
                        <div className="text-xs text-muted-foreground text-right">
                          {e.target_sets ?? "—"}×{reps.length ? reps.join(", ") : "—"}
                        </div>
                      </div>
                      {weights.length > 0 && (
                        <div className="mt-1 text-xs text-gold/90">
                          {weights.map((w, i) => /^\d/.test(w) ? `${w} kg` : w).join(" · ")}
                        </div>
                      )}
                      {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
                      {!isNonExercise && (
                        <a
                          href={demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-gold/50 hover:text-gold"
                        >
                          <PlayCircle className="h-3 w-3" /> Demo ansehen
                        </a>
                      )}
                    </div>
                  );
                })}
            {((planType === "nutrition" ? meals : exercises).filter(
              (x: any) => itemToVirtual[x.id] === activeDay,
            ).length === 0) && (
              <p className="text-sm text-muted-foreground">Keine {empty} für diesen Tag.</p>
            )}
          </div>
        </>
      )}
      {recipeMeal && (
        <RecipeDialog
          meal={recipeMeal}
          displayName={itemDisplayName[recipeMeal.id] ?? recipeMeal.name}
          isCoach={isCoach}
          onClose={() => setRecipeMeal(null)}
        />
      )}
      {swapMeal && isSelf && (
        <MealSwapDialog
          meal={swapMeal}
          displayName={itemDisplayName[swapMeal.id] ?? swapMeal.name}
          userId={clientId}
          onClose={() => setSwapMeal(null)}
          onSwapped={() => { reloadTracked(); }}
        />
      )}
      {skipMeal && isSelf && (
        <SkipReasonDialog
          mealId={skipMeal.id}
          mealName={itemDisplayName[skipMeal.id] ?? skipMeal.name}
          onClose={() => setSkipMeal(null)}
          onSkipped={() => { reloadSkips(); }}
        />
      )}
    </div>
  );
}

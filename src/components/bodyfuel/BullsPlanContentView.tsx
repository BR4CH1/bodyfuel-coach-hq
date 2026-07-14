/**
 * BullsPlanContentView — Engine-first Ernährungsplan-Ansicht für den Bulls Hub.
 *
 * SOURCE OF TRUTH
 * - Tagesziel (kcal + Makros) kommt AUSSCHLIESSLICH aus
 *   getBullsDailyNutritionTargets → Performance Nutrition Engine.
 * - KEINE nutrition_targets, keine planbasierte Zielaggregation.
 * - KEINE lokale Ersatzberechnung.
 *
 * MEAL-DB
 * - Wiederverwendung der bestehenden Rezept-/Mahlzeitendatenbank
 *   (nutrition_plan_meals des aktiven Plans + nutrition_plan_meal_overrides).
 * - Mengen werden gegen das Engine-Tagesziel des jeweiligen Datums
 *   proportional skaliert (kcal-Verhältnis) — Meal-Auswahl bleibt
 *   Coach-/Planvorgabe, Mengenanpassung folgt dem Performance Target.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getBullsDailyNutritionTargets,
  BULLS_DAY_TYPE_LABELS,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";
import { RecipeDialog } from "./RecipeDialog";
import { DayPlanView, type DayPlanMeal } from "./DayPlanView";

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

type Override = {
  id: string;
  plan_meal_id: string;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const today = () => isoDate(new Date());
const addDays = (dateStr: string, delta: number) => {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
};

const mealSlot = (
  idx: number,
  total: number,
): "breakfast" | "lunch" | "dinner" | "snack" => {
  if (idx === 0) return "breakfast";
  if (idx === total - 1 && total > 1) return "dinner";
  if (idx === 1 && total > 2) return "lunch";
  return "snack";
};
const slotFromName = (name: string) => {
  const n = name.toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n)) return "breakfast" as const;
  if (/mittag|lunch/.test(n)) return "lunch" as const;
  if (/abend|dinner|sp(ä|a)t/.test(n)) return "dinner" as const;
  if (/snack|shake|pre[- ]?workout|post[- ]?workout|zwischen/.test(n))
    return "snack" as const;
  return null;
};

export function BullsPlanContentView() {
  const { supabaseUser } = useSession();
  const clientId = supabaseUser?.id;
  const getEngineFn = useServerFn(getBullsDailyNutritionTargets);
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const orgSlug = params.orgSlug;

  const [date, setDate] = useState<string>(today());

  // -- Engine target for the selected date -----------------------------------
  const {
    data: engine,
    isLoading: engineLoading,
    refetch: refetchEngine,
  } = useQuery({
    queryKey: ["bulls-nutrition-targets", date],
    queryFn: () => getEngineFn({ data: { date } }),
    enabled: !!clientId,
  });

  // -- Plan meals from the existing shared recipe DB -------------------------
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dayName, setDayName] = useState<string | null>(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [tracked, setTracked] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string>("");
  const [recipeMeal, setRecipeMeal] = useState<Meal | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      setLoadingMeals(true);
      // Bulls/Performance-Kontext: ausschließlich performance_context=true.
      // Der persönliche BodyFuel-Plan bleibt hier bewusst außen vor.
      const { data: planRow } = await supabase
        .from("nutrition_plans")
        .select("id")
        .eq("client_id", clientId)
        .eq("plan_type", "nutrition")
        .eq("performance_context", true)
        .eq("is_active", true)
        .maybeSingle();
      if (!planRow) {
        if (!cancelled) {
          setMeals([]);
          setDayName(null);
        }
        setLoadingMeals(false);
        return;
      }
      // Auto-Pipeline schreibt einen Tag pro Datum (day_date).
      const { data: dayRows } = await supabase
        .from("nutrition_plan_days")
        .select("id, name, sort_order, day_date")
        .eq("plan_id", planRow.id)
        .order("sort_order");
      const days = (dayRows as { id: string; name: string; sort_order: number; day_date: string | null }[]) ?? [];
      if (!days.length) {
        if (!cancelled) {
          setMeals([]);
          setDayName(null);
        }
        setLoadingMeals(false);
        return;
      }
      // Bevorzugt exakter Datums-Match (Performance-Auto-Plan), sonst
      // Wochentag-Fallback für Legacy-Pläne.
      const byDate = days.find((d) => d.day_date === date);
      const wd = new Date(date + "T12:00:00Z").getUTCDay();
      const monBased = ((wd + 6) % 7) + 1; // 1..7
      const pick =
        byDate ?? days.find((d) => d.sort_order === monBased) ?? days[0];
      const { data: mealRows } = await supabase
        .from("nutrition_plan_meals")
        .select(
          "id, day_id, name, description, kcal, protein_g, carbs_g, fat_g, sort_order",
        )
        .eq("day_id", pick.id)
        .order("sort_order");
      const { data: ovRows } = await supabase
        .from("nutrition_plan_meal_overrides")
        .select("id, plan_meal_id, name, description, kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", clientId)
        .eq("override_date", date);
      const { data: entryRows } = await supabase
        .from("food_entries")
        .select("id, source")
        .eq("user_id", clientId)
        .eq("entry_date", date)
        .or("source.like.plan:%,source.like.perf_plan:%");
      if (cancelled) return;
      setMeals((mealRows as Meal[]) ?? []);
      setDayName(pick.name);
      const ovMap: Record<string, Override> = {};
      ((ovRows as Override[]) ?? []).forEach((o) => {
        ovMap[o.plan_meal_id] = o;
      });
      setOverrides(ovMap);
      const trackedMap: Record<string, string> = {};
      ((entryRows as { id: string; source: string }[]) ?? []).forEach((r) => {
        const id = r.source.startsWith("perf_plan:")
          ? r.source.slice("perf_plan:".length)
          : r.source.slice("plan:".length);
        trackedMap[id] = r.id;
      });
      setTracked(trackedMap);
      setLoadingMeals(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, date]);

  // -- Scaling factor: engine kcal target vs. plan-day kcal ------------------
  const planKcalTotal = useMemo(() => {
    return meals.reduce((s, m) => {
      const ov = overrides[m.id];
      const kcal = ov?.kcal ?? m.kcal ?? 0;
      return s + Number(kcal || 0);
    }, 0);
  }, [meals, overrides]);

  const scale = useMemo(() => {
    const target = engine?.targets?.kcal;
    if (!target || !planKcalTotal) return 1;
    return target / planKcalTotal;
  }, [engine?.targets?.kcal, planKcalTotal]);

  const scaledMeal = (m: Meal) => {
    const ov = overrides[m.id];
    const base = {
      name: ov?.name ?? m.name,
      description: ov?.description ?? m.description,
      kcal: Number(ov?.kcal ?? m.kcal ?? 0),
      protein_g: Number(ov?.protein_g ?? m.protein_g ?? 0),
      carbs_g: Number(ov?.carbs_g ?? m.carbs_g ?? 0),
      fat_g: Number(ov?.fat_g ?? m.fat_g ?? 0),
    };
    return {
      ...base,
      kcal: Math.round(base.kcal * scale),
      protein_g: Math.round(base.protein_g * scale),
      carbs_g: Math.round(base.carbs_g * scale),
      fat_g: Math.round(base.fat_g * scale),
      scale,
    };
  };

  const toggleMeal = async (m: Meal) => {
    if (!clientId) return;
    setTogglingId(m.id);
    try {
      const existing = tracked[m.id];
      if (existing) {
        const { error } = await supabase
          .from("food_entries")
          .delete()
          .eq("id", existing);
        if (error) throw error;
        setTracked((t) => {
          const n = { ...t };
          delete n[m.id];
          return n;
        });
        toast.success("Mahlzeit entfernt");
      } else {
        const s = scaledMeal(m);
        const orderIdx = meals.findIndex((x) => x.id === m.id);
        const slot = slotFromName(s.name) ?? mealSlot(orderIdx, meals.length);
        const { data, error } = await supabase
          .from("food_entries")
          .insert({
            user_id: clientId,
            entry_date: date,
            meal: slot,
            name: s.name + (s.description ? ` — ${s.description}` : ""),
            serving_g: 100,
            kcal: s.kcal,
            protein_g: s.protein_g,
            carbs_g: s.carbs_g,
            fat_g: s.fat_g,
            source: `perf_plan:${m.id}`,
          })
          .select("id")
          .single();
        if (error) throw error;
        setTracked((t) => ({ ...t, [m.id]: (data as { id: string }).id }));
        toast.success(`${s.name} getrackt`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Tracken fehlgeschlagen");
    } finally {
      setTogglingId("");
    }
  };

  if (engineLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Lade Tagesziel…
      </div>
    );
  }

  if (!engine) {
    return null;
  }

  if (engine.needsProfile) {
    return (
      <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <div className="text-xs uppercase tracking-[0.2em] text-gold">
            Performance-Profil fehlt
          </div>
        </div>
        <h2 className="mt-2 font-display text-lg font-bold">
          Vervollständige dein Bulls-Profil
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Damit dein individueller Ernährungsplan automatisch erstellt werden kann,
          brauchen wir noch ein paar Angaben zu dir: Biometrie, Ziel, Lieblingsfoods,
          No-Gos, Allergien und Meal-Prep-Vorlieben.
        </p>
        {orgSlug ? (
          <Link
            to="/$orgSlug/onboarding"
            params={{ orgSlug }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-gold/90"
          >
            Profil vervollständigen
          </Link>
        ) : null}
      </div>
    );
  }


  const target = engine.targets;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      {/* Header: date navigation + day type */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-gold">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Bulls Performance
            </div>
            <div className="font-display text-base font-bold">
              {BULLS_DAY_TYPE_LABELS[engine.dayType]}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {engine.dayTypeSource === "manual" ? "manuell" : "automatisch"}
              {engine.sessionIntensity ? ` · ${engine.sessionIntensity}` : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-gold"
            aria-label="Vorheriger Tag"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[110px] rounded-md border border-border bg-background/40 px-2 py-1 text-center text-xs font-semibold">
            {date === today() ? "Heute" : date}
          </div>
          <button
            onClick={() => setDate((d) => addDays(d, +1))}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-gold"
            aria-label="Nächster Tag"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Engine target header */}
      {target ? (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gradient-to-br from-accent/40 to-card p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
            Tagesziel (Engine)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-display text-3xl font-bold">{target.kcal}</div>
            <div className="text-xs text-muted-foreground">kcal</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <MacroPill label="Protein" value={`${target.protein_g} g`} />
            <MacroPill label="Kohlh." value={`${target.carbs_g} g`} />
            <MacroPill label="Fett" value={`${target.fat_g} g`} />
          </div>
          {engine.coachReviewRequired && (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
              Coach-Review empfohlen — bitte mit deinem Coach abstimmen.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
          Tagesziel konnte nicht berechnet werden.
        </div>
      )}

      {/* Meals list — engine-scaled */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Mahlzeiten {dayName ? `· ${dayName}` : null}
          </div>
          {target && planKcalTotal > 0 && (
            <div className="text-[10px] text-muted-foreground">
              skaliert · Faktor {(scale).toFixed(2)}x
            </div>
          )}
        </div>

        {loadingMeals ? (
          <div className="mt-3 text-sm text-muted-foreground">
            Lade Mahlzeiten…
          </div>
        ) : meals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Für diesen Tag ist noch kein Plan hinterlegt. Dein Coach kann
            Mahlzeiten aus der bestehenden Rezeptdatenbank zuweisen.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {meals.map((m) => {
              const s = scaledMeal(m);
              const isTracked = !!tracked[m.id];
              const busy = togglingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-4 ${
                    isTracked
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border bg-background/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleMeal(m)}
                      disabled={busy}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-bold text-gold">
                        {s.name}
                      </div>
                      {s.description && (
                        <p className="mt-1 text-xs text-foreground/90">
                          {s.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{s.kcal} kcal</span>
                        <span>· P {s.protein_g}g</span>
                        <span>· KH {s.carbs_g}g</span>
                        <span>· F {s.fat_g}g</span>
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => setRecipeMeal(m)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-gold/50 hover:text-gold"
                      >
                        <BookOpen className="h-3 w-3" /> Rezept
                      </button>
                      {isTracked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <Check className="h-3 w-3" /> getrackt
                        </span>
                      ) : busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recipeMeal && (
        <RecipeDialog
          meal={recipeMeal}
          displayName={recipeMeal.name}
          isCoach={false}
          onClose={() => setRecipeMeal(null)}
        />
      )}
      {/* Silence unused refetch — kept for future coach overrides refresh */}
      <div className="hidden">{String(!!refetchEngine)}</div>
    </div>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}

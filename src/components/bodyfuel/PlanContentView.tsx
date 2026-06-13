import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Utensils, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { parseNutritionPlan } from "@/lib/nutrition-plan.functions";
import { parseTrainingPlan } from "@/lib/training.functions";

type Plan = { id: string; client_id: string; title: string };
type Day = { id: string; name: string; sort_order: number };
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
  notes: string | null;
  sort_order: number;
};

type Props = {
  clientId: string;
  planType: "nutrition" | "training";
};

export function PlanContentView({ clientId, planType }: Props) {
  const { isCoach } = useSession();
  const parseNutrition = useServerFn(parseNutritionPlan);
  const parseTraining = useServerFn(parseTrainingPlan);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeDay, setActiveDay] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const dayTable = planType === "nutrition" ? "nutrition_plan_days" : "training_days";
  const itemTable = planType === "nutrition" ? "nutrition_plan_meals" : "training_exercises";

  const reload = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data: planRow } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, title")
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
    const dayList = (dayRows as Day[]) ?? [];
    setDays(dayList);
    setActiveDay((cur) => (dayList.find((d) => d.id === cur) ? cur : dayList[0]?.id ?? ""));

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

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId, planType]);

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
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tag wählen</label>
            <select
              value={activeDay}
              onChange={(e) => setActiveDay(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {planType === "nutrition"
              ? meals.filter((m) => m.day_id === activeDay).map((m) => (
                  <div key={m.id} className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-gold">{m.name}</div>
                      {m.kcal != null && (
                        <div className="text-[11px] text-muted-foreground">{m.kcal} kcal</div>
                      )}
                    </div>
                    {m.description && (
                      <p className="mt-1 text-sm text-foreground/90">{m.description}</p>
                    )}
                    {(m.protein_g != null || m.carbs_g != null || m.fat_g != null) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {m.protein_g != null && <span>P {m.protein_g}g</span>}
                        {m.carbs_g != null && <span>· KH {m.carbs_g}g</span>}
                        {m.fat_g != null && <span>· F {m.fat_g}g</span>}
                      </div>
                    )}
                  </div>
                ))
              : exercises.filter((e) => e.day_id === activeDay).map((e) => (
                  <div key={e.id} className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-semibold">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.target_sets ?? "—"}×{e.target_reps ?? "—"}
                      </div>
                    </div>
                    {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
                  </div>
                ))}
            {((planType === "nutrition" ? meals : exercises).filter(
              (x: any) => x.day_id === activeDay,
            ).length === 0) && (
              <p className="text-sm text-muted-foreground">Keine {empty} für diesen Tag.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

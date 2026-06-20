import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

const DRAFT_KEY = "bf.recipeFromIngredients.draft.v1";
type Draft = {
  ingredients?: string;
  goal?: string;
  recipe?: Recipe | null;
  slot?: Slot;
  tracked?: boolean;
};
import { toast } from "sonner";
import { ChevronLeft, Carrot, Loader2, Check } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { generateRecipeFromIngredients } from "@/lib/recipe-from-ingredients.functions";

export const Route = createFileRoute("/nutrition/recipe-from-ingredients")({
  head: () => ({ meta: [{ title: "Rezept aus Zutaten — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <RecipePage />
    </AppLayout>
  ),
});

type Recipe = {
  name?: string;
  description?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  servings?: number;
  ingredients?: string[];
  steps?: string[];
};

type Slot = "breakfast" | "lunch" | "dinner" | "snack";
const SLOT_LABELS: Record<Slot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

function slotFromHour(h: number): Slot {
  if (h >= 4 && h < 10) return "breakfast";
  if (h >= 10 && h < 15) return "lunch";
  if (h >= 15 && h < 22) return "dinner";
  return "snack";
}
function slotFromName(name: string): Slot {
  const n = (name || "").toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n)) return "breakfast";
  if (/mittag|lunch/.test(n)) return "lunch";
  if (/abend|dinner|sp(ä|a)t/.test(n)) return "dinner";
  return "snack";
}
const todayKey = () => new Date().toISOString().slice(0, 10);

function RecipePage() {
  const { supabaseUser } = useSession();
  const fn = useServerFn(generateRecipeFromIngredients);
  const [ingredients, setIngredients] = useState("");
  const [goal, setGoal] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const defaultSlot = useMemo<Slot>(() => slotFromHour(new Date().getHours()), [recipe]);
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);

  const gen = useMutation({
    mutationFn: () => fn({ data: { ingredients, goal: goal || undefined } }),
    onSuccess: (d) => {
      setRecipe(d as Recipe);
      setSlot(slotFromHour(new Date().getHours()));
      setTracked(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const track = async () => {
    if (!recipe || !supabaseUser) return;
    setTracking(true);
    try {
      // Find today's plan meal in the chosen slot (if user has an active nutrition plan)
      let replacedPlanMealId: string | null = null;
      const { data: plan } = await supabase
        .from("nutrition_plans")
        .select("id")
        .eq("client_id", supabaseUser.id)
        .eq("plan_type", "nutrition")
        .eq("is_active", true)
        .maybeSingle();

      if (plan?.id) {
        const { data: dayRows } = await supabase
          .from("nutrition_plan_days")
          .select("id")
          .eq("plan_id", plan.id);
        const dayIds = (dayRows ?? []).map((d: any) => d.id);
        if (dayIds.length) {
          const { data: planMeals } = await supabase
            .from("nutrition_plan_meals")
            .select("id, name")
            .in("day_id", dayIds);
          const match = (planMeals ?? []).find((m: any) => slotFromName(m.name) === slot);
          if (match) {
            replacedPlanMealId = match.id;
            // Clear any existing tracked plan entry for that meal today
            await supabase
              .from("food_entries")
              .delete()
              .eq("user_id", supabaseUser.id)
              .eq("entry_date", todayKey())
              .or(`source.eq.plan:${match.id},source.eq.swap:${match.id},source.eq.custom:${match.id}`);
          }
        }
      }

      const sourceTag = replacedPlanMealId ? `custom:${replacedPlanMealId}` : "custom:freeform";
      const { error } = await supabase.from("food_entries").insert({
        user_id: supabaseUser.id,
        entry_date: todayKey(),
        meal: slot,
        name: `${recipe.name ?? "Eigenes Rezept"}${recipe.description ? " — " + recipe.description : ""}`,
        serving_g: 100,
        kcal: Math.round(recipe.kcal ?? 0),
        protein_g: Math.round(recipe.protein_g ?? 0),
        carbs_g: Math.round(recipe.carbs_g ?? 0),
        fat_g: Math.round(recipe.fat_g ?? 0),
        source: sourceTag,
      });
      if (error) throw error;
      setTracked(true);
      toast.success(
        replacedPlanMealId
          ? `${SLOT_LABELS[slot]} im Plan ersetzt und getrackt`
          : `Als ${SLOT_LABELS[slot]} getrackt`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Tracken fehlgeschlagen");
    } finally {
      setTracking(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        to="/nutrition"
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold">Rezept aus meinen Zutaten</h1>
        <p className="text-sm text-muted-foreground">
          Sag uns, was du da hast — wir bauen dir daraus ein Rezept.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Deine Zutaten
          </label>
          <Textarea
            rows={4}
            placeholder="z.B. 200g Hähnchenbrust, 1 Paprika, 100g Reis, Knoblauch, Sojasauce"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ziel / Wunsch (optional)
          </label>
          <Input
            placeholder="z.B. proteinreich, low carb, schnell"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <Button
          onClick={() => gen.mutate()}
          disabled={gen.isPending || !ingredients.trim()}
          className="bg-gradient-gold text-primary-foreground"
        >
          {gen.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generiere…
            </>
          ) : (
            <>
              <Carrot className="mr-2 h-4 w-4" /> Rezept erstellen
            </>
          )}
        </Button>
      </div>

      {recipe && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">{recipe.name}</h2>
            {recipe.description && (
              <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Macro label="kcal" value={recipe.kcal} />
            <Macro label="Protein" value={recipe.protein_g} unit="g" />
            <Macro label="Carbs" value={recipe.carbs_g} unit="g" />
            <Macro label="Fett" value={recipe.fat_g} unit="g" />
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Zutaten {recipe.servings ? `(${recipe.servings} Portion${recipe.servings > 1 ? "en" : ""})` : ""}
              </h3>
              <ul className="space-y-1 text-sm">
                {recipe.ingredients.map((i, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-gold">•</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Zubereitung
              </h3>
              <ol className="space-y-2 text-sm">
                {recipe.steps.map((s, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-bold text-gold">{idx + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {supabaseUser && (
            <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gold">
                Als Mahlzeit tracken
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SLOT_LABELS) as Slot[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                      slot === s
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border text-muted-foreground hover:border-gold/50"
                    }`}
                  >
                    {SLOT_LABELS[s]}
                    {s === defaultSlot && (
                      <span className="ml-1 text-[10px] opacity-70">(jetzt)</span>
                    )}
                  </button>
                ))}
              </div>
              <Button
                onClick={track}
                disabled={tracking || tracked}
                className="w-full bg-gradient-gold text-primary-foreground"
              >
                {tracking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tracke…
                  </>
                ) : tracked ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Getrackt
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Als {SLOT_LABELS[slot]} tracken
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Wenn du heute einen Plan hast, ersetzt das automatisch dein geplantes{" "}
                {SLOT_LABELS[slot]}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Macro({ label, value, unit }: { label: string; value?: number; unit?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-base font-bold">
        {value ?? "–"}
        {unit && value != null ? unit : ""}
      </div>
    </div>
  );
}

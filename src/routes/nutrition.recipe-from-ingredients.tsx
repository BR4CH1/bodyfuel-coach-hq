import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Carrot, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

function RecipePage() {
  const fn = useServerFn(generateRecipeFromIngredients);
  const [ingredients, setIngredients] = useState("");
  const [goal, setGoal] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const gen = useMutation({
    mutationFn: () => fn({ data: { ingredients, goal: goal || undefined } }),
    onSuccess: (d) => setRecipe(d as Recipe),
    onError: (e: Error) => toast.error(e.message),
  });

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
          Sag uns, was du da hast — die KI baut daraus ein Rezept.
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

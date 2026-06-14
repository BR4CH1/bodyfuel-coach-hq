import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Suggestion = {
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  category?: string;
};

export const suggestMealSwaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    // Load the source meal + authorize
    const { data: meal, error: mErr } = await supabase
      .from("nutrition_plan_meals")
      .select("id, name, description, kcal, protein_g, carbs_g, fat_g, day_id")
      .eq("id", data.meal_id)
      .maybeSingle();
    if (mErr || !meal) throw new Error(mErr?.message || "Mahlzeit nicht gefunden");

    const { data: dayRow } = await supabase
      .from("nutrition_plan_days")
      .select("plan_id, nutrition_plans!inner(client_id)")
      .eq("id", meal.day_id)
      .maybeSingle();
    const clientId = (dayRow as any)?.nutrition_plans?.client_id;
    if (clientId !== userId) throw new Error("Forbidden");

    if (!meal.kcal || !meal.protein_g || !meal.carbs_g || !meal.fat_g) {
      throw new Error("Mahlzeit hat keine vollständigen Makros — bitte zuerst tracken/schätzen.");
    }

    // Build personalization context
    const [
      { data: ratings },
      { data: favs },
      { data: swapped },
      { data: profile },
    ] = await Promise.all([
      supabase
        .from("meal_ratings")
        .select("stars, meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("meal_favorites")
        .select("meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", userId)
        .limit(20),
      supabase
        .from("meal_interactions")
        .select("meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", userId)
        .eq("kind", "swapped")
        .limit(20),
      supabase
        .from("smart_nutrition_profile")
        .select("favorite_foods, nogo_foods, allergies, extra_favorites, extra_nogos, extra_allergies, meal_prep_style, budget_band")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const liked = (ratings ?? [])
      .filter((r: any) => r.stars >= 4)
      .map((r: any) => r.meal?.name)
      .filter(Boolean)
      .slice(0, 10);
    const disliked = (ratings ?? [])
      .filter((r: any) => r.stars <= 2)
      .map((r: any) => r.meal?.name)
      .filter(Boolean)
      .slice(0, 10);
    const favoriteNames = (favs ?? []).map((f: any) => f.meal?.name).filter(Boolean);
    const swappedNames = (swapped ?? []).map((s: any) => s.meal?.name).filter(Boolean);

    const p: any = profile ?? {};
    const allergyList = [
      ...(p.allergies ?? []),
      ...((p.extra_allergies ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const nogoList = [
      ...(p.nogo_foods ?? []),
      ...((p.extra_nogos ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const favFoods = [
      ...(p.favorite_foods ?? []),
      ...((p.extra_favorites ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const prepHint =
      p.meal_prep_style === "low_effort" ? "Sehr einfache, schnelle Rezepte (max 15 Min)." :
      p.meal_prep_style === "meal_prep" ? "Meal-Prep-tauglich, gut vorbereitbar." :
      p.meal_prep_style === "2_3_week" ? "Rezepte die für 2-3 Tage halten." :
      p.meal_prep_style === "daily" ? "Frisch kochbar, alltagstauglich." : "";
    const budgetHint =
      p.budget_band === "<50" ? "Günstige Zutaten bevorzugen." :
      p.budget_band === "50_75" ? "Mittleres Budget." :
      p.budget_band === ">100" ? "Budget ist großzügig." : "";

    const prompt = `Du bist Ernährungsberater. Schlage 5 alternative Gerichte vor, die als 1:1-Tausch für die untenstehende Mahlzeit dienen.

ORIGINAL-MAHLZEIT: ${meal.name}${meal.description ? " — " + meal.description : ""}
Makros: ${meal.kcal} kcal · ${meal.protein_g}g Protein · ${meal.carbs_g}g Kohlenhydrate · ${meal.fat_g}g Fett

HARTE REGEL — ABWEICHUNG MAX ±5%:
- kcal: ${Math.round(meal.kcal * 0.95)}–${Math.round(meal.kcal * 1.05)}
- Protein: ${Math.round(meal.protein_g * 0.95)}–${Math.round(meal.protein_g * 1.05)} g
- Kohlenhydrate: ${Math.round(meal.carbs_g * 0.95)}–${Math.round(meal.carbs_g * 1.05)} g
- Fett: ${Math.round(meal.fat_g * 0.95)}–${Math.round(meal.fat_g * 1.05)} g

🚨 ABSOLUTE AUSSCHLÜSSE (höchste Priorität, NIEMALS verwenden!):
${allergyList.length ? "ALLERGIEN/UNVERTRÄGLICHKEITEN: " + allergyList.join(", ") : "(keine)"}
${nogoList.length ? "NO-GO LEBENSMITTEL: " + nogoList.join(", ") : "(keine)"}

KUNDEN-VORLIEBEN (berücksichtigen!):
${favFoods.length ? "Lieblings-Lebensmittel (Profil): " + favFoods.join(", ") : ""}
${favoriteNames.length ? "Favorisierte Rezepte: " + favoriteNames.join(", ") : ""}
${liked.length ? "Mag (4-5★): " + liked.join(", ") : ""}
${disliked.length ? "Mag NICHT (1-2★) — vermeiden: " + disliked.join(", ") : ""}
${swappedNames.length ? "Bereits abgelehnt — nicht erneut vorschlagen: " + swappedNames.join(", ") : ""}
${prepHint}
${budgetHint}

Antworte ausschließlich mit gültigem JSON in dieser Form:
{"suggestions":[{"name":"Chicken Burger Bowl","description":"180g Hähnchen, 60g Reis, …","kcal":800,"protein_g":50,"carbs_g":90,"fat_g":25,"category":"Burger Bowl"}]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
    if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: Suggestion[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = {};
    }

    const withinTolerance = (orig: number, val: number) =>
      val >= orig * 0.95 && val <= orig * 1.05;

    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => s && typeof s.name === "string" && s.kcal && s.protein_g && s.carbs_g && s.fat_g)
      .filter(
        (s) =>
          withinTolerance(meal.kcal!, s.kcal) &&
          withinTolerance(meal.protein_g!, s.protein_g) &&
          withinTolerance(meal.carbs_g!, s.carbs_g) &&
          withinTolerance(meal.fat_g!, s.fat_g),
      )
      .slice(0, 5);

    return {
      original: {
        kcal: meal.kcal,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
      },
      suggestions,
    };
  });

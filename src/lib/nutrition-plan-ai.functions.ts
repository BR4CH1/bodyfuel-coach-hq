import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

type GeneratedMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
type GeneratedDay = { name: string; meals: GeneratedMeal[] };

/**
 * Generate a 7-day nutrition plan draft using AI, respecting:
 * - macro/kcal targets
 * - allergies & no-go foods (hard filter)
 * - favorite foods, ratings, favorites, skips (soft signals)
 * - meal prep style and budget
 *
 * Creates a nutrition_plans row with status='draft' (not auto-active).
 */
export const generateAiNutritionPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id;

    // Authorize: self or coach
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (target !== userId && !isCoach) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const [
      { data: profile },
      { data: targets },
      { data: ratings },
      { data: favs },
      { data: skips },
      { data: prof },
    ] = await Promise.all([
      supabase
        .from("smart_nutrition_profile")
        .select("*")
        .eq("user_id", target)
        .maybeSingle(),
      supabase
        .from("nutrition_targets")
        .select("kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", target)
        .maybeSingle(),
      supabase
        .from("meal_ratings")
        .select("stars, meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", target)
        .limit(30),
      supabase
        .from("meal_favorites")
        .select("meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", target)
        .limit(20),
      supabase
        .from("meal_skips")
        .select("meal_name, reason")
        .eq("user_id", target)
        .limit(20),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", target)
        .maybeSingle(),
    ]);

    const t = (targets as any) ?? {};
    const kcal = t.kcal ?? 2200;
    const protein = t.protein_g ?? 150;
    const carbs = t.carbs_g ?? 240;
    const fat = t.fat_g ?? 70;

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
    const liked = (ratings ?? [])
      .filter((r: any) => r.stars >= 4)
      .map((r: any) => r.meal?.name)
      .filter(Boolean);
    const disliked = (ratings ?? [])
      .filter((r: any) => r.stars <= 2)
      .map((r: any) => r.meal?.name)
      .filter(Boolean);
    const favoriteNames = (favs ?? []).map((f: any) => f.meal?.name).filter(Boolean);
    const skipReasons = (skips ?? [])
      .filter((s: any) => s.meal_name)
      .map((s: any) => `${s.meal_name} (${s.reason})`);

    const prepHint = p.meal_prep_style === "low_effort" ? "Sehr einfache Rezepte (max 15 Min)." :
      p.meal_prep_style === "meal_prep" ? "Meal-Prep-tauglich." :
      p.meal_prep_style === "2_3_week" ? "Hält 2-3 Tage." :
      p.meal_prep_style === "daily" ? "Frisch kochbar." : "";
    const budgetHint = p.budget_band === "<50" ? "Günstige Zutaten." :
      p.budget_band === "50_75" ? "Mittleres Budget." :
      p.budget_band === ">100" ? "Großzügiges Budget." : "";

    // Plan length = days until the customer's next shopping day (1–7).
    const planDays = daysUntilNextShopping(p.shopping_days);

    const prompt = `Erstelle einen ${planDays}-Tage-Ernährungsplan mit 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack). Der Plan soll genau bis zum nächsten Einkaufstag reichen.

TAGESZIEL (jeder Tag soll diese Werte ±5 % treffen):
- kcal: ${kcal}
- Protein: ${protein} g
- Kohlenhydrate: ${carbs} g
- Fett: ${fat} g

🚨 ABSOLUTE AUSSCHLÜSSE — niemals verwenden:
${allergyList.length ? "ALLERGIEN: " + allergyList.join(", ") : "(keine)"}
${nogoList.length ? "NO-GO: " + nogoList.join(", ") : "(keine)"}

KUNDEN-VORLIEBEN (priorisieren):
${favFoods.length ? "Lieblings-Foods: " + favFoods.join(", ") : ""}
${favoriteNames.length ? "Favorisierte Rezepte: " + favoriteNames.slice(0, 10).join(", ") : ""}
${liked.length ? "Mag (4-5★): " + liked.slice(0, 10).join(", ") : ""}
${disliked.length ? "Mag NICHT — vermeiden: " + disliked.slice(0, 10).join(", ") : ""}
${skipReasons.length ? "Häufig übersprungen: " + skipReasons.slice(0, 8).join("; ") : ""}
${prepHint} ${budgetHint}

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{"days":[{"name":"Tag 1","meals":[{"slot":"breakfast","name":"…","description":"Zutaten + Mengen","kcal":500,"protein_g":35,"carbs_g":55,"fat_g":15}]}]}
Genau ${planDays} Tage, je 4 Mahlzeiten. Tagesnamen "Tag 1"…"Tag ${planDays}" oder Wochentage. Tagessummen müssen die Ziele treffen.`;

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
    let parsed: { days?: GeneratedDay[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden.");
    }
    const days = (parsed.days ?? []).slice(0, planDays);
    if (!days.length) throw new Error("Keine Tage generiert.");

    // Hard filter: drop any meal containing a forbidden substring
    const forbidden = [...allergyList, ...nogoList]
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);
    const cleaned = days.map((d) => ({
      name: d.name || "Tag",
      meals: (d.meals ?? []).filter((m) => {
        const hay = `${m.name} ${m.description ?? ""}`.toLowerCase();
        return !forbidden.some((f) => hay.includes(f));
      }),
    }));

    // Create the draft plan
    const { data: planRow, error: planErr } = await supabase
      .from("nutrition_plans")
      .insert({
        client_id: target,
        title: `Smart-Plan Entwurf — ${new Date().toLocaleDateString("de-DE")}`,
        plan_type: "nutrition",
        is_active: false,
        status: p.auto_publish ? "active" : "draft",
        generated_by: "ai_auto",
        uploaded_by: userId,
        file_path: `ai-generated/${target}/${Date.now()}.json`,
        file_name: "ai-generated.json",
      })
      .select("id")
      .single();
    if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

    // Insert days & meals
    for (let i = 0; i < cleaned.length; i++) {
      const d = cleaned[i];
      const { data: dayRow, error: dErr } = await supabase
        .from("nutrition_plan_days")
        .insert({ plan_id: planRow.id, name: d.name, sort_order: i })
        .select("id")
        .single();
      if (dErr || !dayRow) continue;
      const mealRows = d.meals.map((m, idx) => ({
        day_id: dayRow.id,
        name: `${d.name} — ${labelForSlot(m.slot)}`,
        description: m.description ?? null,
        kcal: m.kcal ?? null,
        protein_g: m.protein_g ?? null,
        carbs_g: m.carbs_g ?? null,
        fat_g: m.fat_g ?? null,
        sort_order: idx,
      }));
      if (mealRows.length) {
        await supabase.from("nutrition_plan_meals").insert(mealRows);
      }
    }

    // If auto_publish, mark as the active plan and deactivate others
    if (p.auto_publish) {
      await supabase
        .from("nutrition_plans")
        .update({ is_active: false })
        .eq("client_id", target)
        .eq("plan_type", "nutrition")
        .neq("id", planRow.id);
      await supabase
        .from("nutrition_plans")
        .update({ is_active: true })
        .eq("id", planRow.id);
    }

    return {
      ok: true,
      plan_id: planRow.id,
      status: p.auto_publish ? "active" : "draft",
      days: cleaned.length,
      meals: cleaned.reduce((s, d) => s + d.meals.length, 0),
    };
  });

function labelForSlot(slot: string): string {
  switch (slot) {
    case "breakfast": return "Frühstück";
    case "lunch": return "Mittagessen";
    case "dinner": return "Abendessen";
    case "snack": return "Snack";
    default: return "Mahlzeit";
  }
}

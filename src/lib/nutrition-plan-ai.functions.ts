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
type GeneratedDay = { name: string; type?: "training" | "rest"; meals: GeneratedMeal[] };


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
  .inputValidator(
    (d: { user_id: string; scheduled_start_date?: string | null; title?: string }) => d,
  )
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
      { data: swaps },
    ] = await Promise.all([
      supabase
        .from("smart_nutrition_profile")
        .select("*")
        .eq("user_id", target)
        .maybeSingle(),
      supabase
        .from("nutrition_targets")
        .select("kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest")
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
        .from("meal_interactions")
        .select("kind, meal:nutrition_plan_meals!inner(name)")
        .eq("user_id", target)
        .eq("kind", "swapped")
        .limit(30),
    ]);


    const t = (targets as any) ?? {};
    const kcal = t.kcal ?? 2200;
    const protein = t.protein_g ?? 150;
    const carbs = t.carbs_g ?? 240;
    const fat = t.fat_g ?? 70;
    const hasRest = t.kcal_rest != null;
    const kcalR = t.kcal_rest ?? kcal;
    const proteinR = t.protein_g_rest ?? protein;
    const carbsR = t.carbs_g_rest ?? carbs;
    const fatR = t.fat_g_rest ?? fat;


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
    const swappedNames = (swaps ?? [])
      .map((s: any) => s.meal?.name)
      .filter(Boolean);
    // Top swapped (frequency)
    const swapFreq = swappedNames.reduce<Record<string, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {});
    const topSwapped = Object.entries(swapFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([n, c]) => `${n} (${c}×)`);

    const prepHint = p.meal_prep_style === "low_effort" ? "Sehr einfache Rezepte (max 15 Min)." :
      p.meal_prep_style === "meal_prep" ? "Meal-Prep-tauglich." :
      p.meal_prep_style === "2_3_week" ? "Hält 2-3 Tage." :
      p.meal_prep_style === "daily" ? "Frisch kochbar." : "";
    const budgetHint = p.budget_band === "<50" ? "Günstige Zutaten." :
      p.budget_band === "50_75" ? "Mittleres Budget." :
      p.budget_band === ">100" ? "Großzügiges Budget." : "";

    // Plan length = days until the customer's next shopping day (1–7).
    const planDays = daysUntilNextShopping(p.shopping_days);

    // Decide training/rest distribution roughly 4:3 over a week, scaled to planDays.
    const restCount = hasRest ? Math.max(1, Math.round(planDays * 3 / 7)) : 0;
    const trainingCount = planDays - restCount;

    const targetsBlock = hasRest
      ? `Es gibt ZWEI verschiedene Tagesziele — ordne jedem Tag den passenden Typ zu:

TRAININGSTAG (für "type":"training", jeder solche Tag ±5 % treffen):
- kcal: ${kcal}
- Protein: ${protein} g
- Kohlenhydrate: ${carbs} g
- Fett: ${fat} g

RESTDAY (für "type":"rest", jeder solche Tag ±5 % treffen):
- kcal: ${kcalR}
- Protein: ${proteinR} g
- Kohlenhydrate: ${carbsR} g
- Fett: ${fatR} g

Verteilung über die ${planDays} Tage: ${trainingCount}× Trainingstag, ${restCount}× Restday. Mische sie sinnvoll (z. B. abwechselnd) — nicht alle Restdays am Ende.`
      : `TAGESZIEL (jeder Tag soll diese Werte ±5 % treffen):
- kcal: ${kcal}
- Protein: ${protein} g
- Kohlenhydrate: ${carbs} g
- Fett: ${fat} g`;

    const prompt = `Erstelle einen ${planDays}-Tage-Ernährungsplan mit 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack). Der Plan soll genau bis zum nächsten Einkaufstag reichen.

${targetsBlock}

🚨 ABSOLUTE AUSSCHLÜSSE — niemals verwenden:
${allergyList.length ? "ALLERGIEN: " + allergyList.join(", ") : "(keine)"}
${nogoList.length ? "NO-GO: " + nogoList.join(", ") : "(keine)"}

KUNDEN-VORLIEBEN (priorisieren):
${favFoods.length ? "Lieblings-Foods: " + favFoods.join(", ") : ""}
${favoriteNames.length ? "Favorisierte Rezepte: " + favoriteNames.slice(0, 10).join(", ") : ""}
${liked.length ? "Mag (4-5★): " + liked.slice(0, 10).join(", ") : ""}
${disliked.length ? "Mag NICHT — vermeiden: " + disliked.slice(0, 10).join(", ") : ""}
${topSwapped.length ? "Häufig getauscht (lieber meiden): " + topSwapped.join(", ") : ""}
${skipReasons.length ? "Häufig übersprungen: " + skipReasons.slice(0, 8).join("; ") : ""}
${prepHint} ${budgetHint}

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{"days":[{"name":"Tag 1","type":"${hasRest ? "training" : "training"}","meals":[{"slot":"breakfast","name":"…","description":"Zutaten + Mengen","kcal":500,"protein_g":35,"carbs_g":55,"fat_g":15}]}]}
Genau ${planDays} Tage, je 4 Mahlzeiten. ${hasRest ? `Jeder Tag MUSS ein Feld "type" mit "training" ODER "rest" enthalten. Im "name" soll " — Trainingstag" oder " — Restday" stehen (Beispiel: "Tag 1 — Trainingstag", "Tag 2 — Restday"), damit die App den Tagestyp erkennt.` : `Tagesnamen "Tag 1"…"Tag ${planDays}".`} Tagessummen müssen die jeweiligen Ziele treffen.`;



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

    // Archive any existing draft/approved/published plan so the unique
    // "one next plan per client" constraint stays satisfied.
    await supabase
      .from("nutrition_plans")
      .update({ status: "archived" })
      .eq("client_id", target)
      .eq("plan_type", "nutrition")
      .in("status", ["draft", "approved", "published"]);

    // Compute average daily macros from generated meals
    const totalDays = Math.max(1, cleaned.length);
    const sums = cleaned.reduce(
      (acc, d) => {
        for (const m of d.meals) {
          acc.kcal += m.kcal ?? 0;
          acc.p += m.protein_g ?? 0;
          acc.c += m.carbs_g ?? 0;
          acc.f += m.fat_g ?? 0;
        }
        return acc;
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    const avgKcal = Math.round(sums.kcal / totalDays);
    const avgP = Math.round(sums.p / totalDays);
    const avgC = Math.round(sums.c / totalDays);
    const avgF = Math.round(sums.f / totalDays);

    // Default scheduled window: start = next shopping day, end = day before the one after
    const start = data.scheduled_start_date
      ? new Date(data.scheduled_start_date)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + planDays);
          return d;
        })();
    const end = new Date(start);
    end.setDate(end.getDate() + totalDays - 1);
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);

    // Create the draft plan
    const { data: planRow, error: planErr } = await supabase
      .from("nutrition_plans")
      .insert({
        client_id: target,
        title:
          data.title?.trim() ||
          `Smart-Plan — ${new Date().toLocaleDateString("de-DE")}`,
        plan_type: "nutrition",
        is_active: false,
        status: "draft",
        generated_by: "ai_auto",
        source: "smart_ai",
        uploaded_by: userId,
        file_path: `ai-generated/${target}/${Date.now()}.json`,
        file_name: "ai-generated.json",
        scheduled_start_date: isoDate(start),
        scheduled_end_date: isoDate(end),
        kcal: avgKcal,
        protein_g: avgP,
        carbs_g: avgC,
        fat_g: avgF,
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

    // Auto-generate shopping list for this draft so the customer sees it under "Nächste Einkaufsliste".
    try {
      const { generateShoppingListForPlan } = await import("./shopping-list-engine.server");
      await generateShoppingListForPlan({
        supabase,
        apiKey,
        planId: planRow.id,
        windowDays: planDays,
      });
    } catch (e) {
      // Non-fatal: list can be generated on demand from the UI.
      console.warn("Auto shopping list failed:", e);
    }


    return {
      ok: true,
      plan_id: planRow.id,
      status: "draft",
      days: cleaned.length,
      meals: cleaned.reduce((s, d) => s + d.meals.length, 0),
      avg_kcal: avgKcal,
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
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

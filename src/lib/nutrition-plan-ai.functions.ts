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
type MacroTarget = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };


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
      { data: clientProfile },
      { data: latestWeight },
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
        .from("profiles")
        .select("display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level, coaching_goal")
        .eq("id", target)
        .maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", target)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(1)
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



    // ---- Individuelles Ziel & Körperdaten ----
    const cp: any = clientProfile ?? {};
    const currentWeight: number | null = (latestWeight as any)?.weight_kg ?? null;
    const goalWeight: number | null = cp.goal_weight_kg ?? null;
    const height: number | null = cp.height_cm ?? null;
    const gender: string | null = cp.gender ?? null;
    const ageYears: number | null = cp.birthdate
      ? Math.floor((Date.now() - new Date(cp.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    const activityLevel: string | null = cp.activity_level ?? null;
    const coachingGoal: string | null = cp.coaching_goal ?? null;

    // Goal direction: cut / bulk / maintain anhand Zielgewicht vs aktuelles Gewicht
    let goalDirection: "cut" | "bulk" | "maintain" = "maintain";
    if (currentWeight && goalWeight) {
      const diff = goalWeight - currentWeight;
      if (diff <= -1) goalDirection = "cut";
      else if (diff >= 1) goalDirection = "bulk";
    } else if (coachingGoal) {
      const g = coachingGoal.toLowerCase();
      if (/(abnehm|fett|cut|diät|diet|lose)/.test(g)) goalDirection = "cut";
      else if (/(aufbau|muskel|bulk|gain|zunehm)/.test(g)) goalDirection = "bulk";
    }

    // Fallback-Targets via Mifflin-St Jeor wenn keine nutrition_targets gepflegt
    const t = (targets as any) ?? {};
    let baseKcal: number | undefined = t.kcal;
    let baseProtein: number | undefined = t.protein_g;
    let baseCarbs: number | undefined = t.carbs_g;
    let baseFat: number | undefined = t.fat_g;

    if (!baseKcal && currentWeight && height && ageYears) {
      const bmr = gender === "female"
        ? 10 * currentWeight + 6.25 * height - 5 * ageYears - 161
        : 10 * currentWeight + 6.25 * height - 5 * ageYears + 5;
      const actFactor =
        activityLevel === "sedentary" ? 1.3 :
        activityLevel === "light" ? 1.45 :
        activityLevel === "very_active" ? 1.75 :
        activityLevel === "athlete" ? 1.9 : 1.6;
      let tdee = bmr * actFactor;
      if (goalDirection === "cut") tdee -= 400;
      else if (goalDirection === "bulk") tdee += 300;
      baseKcal = Math.round(tdee / 10) * 10;
      const proteinPerKg = goalDirection === "cut" ? 2.2 : goalDirection === "bulk" ? 2.0 : 1.8;
      baseProtein = Math.round(currentWeight * proteinPerKg);
      baseFat = Math.round((baseKcal * 0.27) / 9);
      const remainingKcal = baseKcal - baseProtein * 4 - baseFat * 9;
      baseCarbs = Math.max(80, Math.round(remainingKcal / 4));
    }

    const { training: trainingTargets, rest: restTargets } = buildIssnCarbCyclingTargets({
      kcal: baseKcal ?? 2200,
      protein_g: baseProtein ?? 150,
      carbs_g: baseCarbs ?? 240,
      fat_g: baseFat ?? 70,
    });
    const kcal = trainingTargets.kcal;
    const protein = trainingTargets.protein_g;
    const carbs = trainingTargets.carbs_g;
    const fat = trainingTargets.fat_g;
    const kcalR = restTargets.kcal;
    const proteinR = restTargets.protein_g;
    const carbsR = restTargets.carbs_g;
    const fatR = restTargets.fat_g;



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

    // Compute the actual start date now so we can align day types with weekdays.
    const start = data.scheduled_start_date
      ? new Date(data.scheduled_start_date)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + planDays);
          return d;
        })();

    const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
    const WEEKDAY_LABELS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
    const trainingSet = new Set<string>((p.training_weekdays ?? []).map((s: string) => s.toLowerCase()));
    const hasTrainingConfig = trainingSet.size > 0;

    // Build the per-day schedule: real weekday + type for each plan day.
    const schedule = Array.from({ length: planDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const wkIdx = d.getDay();
      const wkKey = WEEKDAY_KEYS[wkIdx];
      const wkLabel = WEEKDAY_LABELS_DE[wkIdx];
      let type: "training" | "rest";
      if (hasTrainingConfig) {
        type = trainingSet.has(wkKey) ? "training" : "rest";
      } else {
        type = i % 7 < 4 ? "training" : "rest";
      }
      return { wkKey, wkLabel, type };
    });

    const trainingCount = schedule.filter((s) => s.type === "training").length;
    const restCount = schedule.length - trainingCount;

    const scheduleLines = schedule
      .map((s, i) => `Tag ${i + 1} (${s.wkLabel}): ${s.type === "training" ? "TRAININGSTAG" : "RESTDAY"}`)
      .join("\n");

    const targetsBlock = `Es gibt ZWEI verschiedene Tagesziele — jeder Tag MUSS dem Typ aus dem Tagesplan unten folgen.

📌 GRUNDREGEL Sportwissenschaft (Carb-Cycling):
Trainingstage haben IMMER mehr Kalorien & Kohlenhydrate als Restdays (höherer Glykogen-/Energiebedarf).
Protein bleibt an beiden Tagen ähnlich. Fett darf am Restday leicht höher sein.

TRAININGSTAG-Ziel (für "type":"training", ±5 % treffen):
- kcal: ${kcal}
- Protein: ${protein} g
- Kohlenhydrate: ${carbs} g
- Fett: ${fat} g

RESTDAY-Ziel (für "type":"rest", ±5 % treffen):
- kcal: ${kcalR}
- Protein: ${proteinR} g
- Kohlenhydrate: ${carbsR} g
- Fett: ${fatR} g

VORGEGEBENER TAGESPLAN (Reihenfolge ist verbindlich, ${trainingCount}× Training / ${restCount}× Rest):
${scheduleLines}`;

    const goalLabel = goalDirection === "cut" ? "FETTABBAU (moderates Kaloriendefizit, hohes Protein)" :
      goalDirection === "bulk" ? "MUSKELAUFBAU (leichter Kalorienüberschuss, hohes Protein, ausreichend Carbs)" :
      "GEWICHT HALTEN / Recomp";

    const goalBlock = `👤 INDIVIDUELLES KUNDENZIEL — Plan MUSS hierauf abgestimmt sein:
- Ziel: ${goalLabel}${coachingGoal ? ` (Eigenangabe: "${coachingGoal}")` : ""}
${currentWeight ? `- Aktuelles Gewicht: ${currentWeight} kg` : ""}
${goalWeight ? `- Zielgewicht: ${goalWeight} kg${currentWeight ? ` (Differenz: ${(goalWeight - currentWeight).toFixed(1)} kg)` : ""}` : ""}
${height ? `- Größe: ${height} cm` : ""}
${ageYears ? `- Alter: ${ageYears} J.` : ""}
${gender ? `- Geschlecht: ${gender}` : ""}
${activityLevel ? `- Aktivitätslevel: ${activityLevel}` : ""}

Die unten genannten Kalorien-/Makro-Ziele sind bereits auf dieses Ziel kalibriert. Wähle Lebensmittel & Portionsgrößen, die das Ziel optimal unterstützen (Sättigung bei Cut, energiedichte Carbs bei Bulk, ausgewogen bei Maintain).`;

    const prompt = `Erstelle einen ${planDays}-Tage-Ernährungsplan mit 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack). Der Plan soll genau bis zum nächsten Einkaufstag reichen.

${goalBlock}

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
{"days":[{"name":"Tag 1","type":"training","meals":[{"slot":"breakfast","name":"Overnight Oats","description":"80g Haferflocken, 250ml fettarme Milch, 150g Skyr, 100g Beeren, 1 EL Chiasamen, 1 EL Mandelsplitter","kcal":500,"protein_g":35,"carbs_g":55,"fat_g":15}]}]}
Genau ${planDays} Tage in der vorgegebenen Reihenfolge, je 4 Mahlzeiten. Jeder Tag MUSS ein Feld "type" mit "training" ODER "rest" enthalten (passend zum Tagesplan oben). Tagessummen müssen die jeweiligen Ziele treffen.

WICHTIG zu name/description:
- "name" = konkreter Gerichtsname (z. B. Overnight Oats, Hähnchen-Reis-Bowl).
- "description" = NUR kommagetrennte Zutaten mit Mengen (z. B. 80g Haferflocken, 250ml Milch). NIEMALS Zubereitungsanweisungen.
- JEDE Zutat MUSS eine konkrete Menge in g, ml, Stück oder EL/TL haben — NIEMALS "Portion", "etwas", "nach Geschmack" o. ä. Auch Salat, Gemüse, Beilagen und Toppings IMMER in Gramm angeben (z. B. "150g Blattsalat", "200g Brokkoli", "30g Feldsalat").`;



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

    // Hard filter + authoritative day type from `schedule`.
    const forbidden = [...allergyList, ...nogoList]
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);
    const cleaned = days.map((d, i) => {
      const s = schedule[i] ?? schedule[schedule.length - 1];
      const typeLabel = s.type === "rest" ? "Restday" : "Trainingstag";
      const name = `${s.wkLabel} — ${typeLabel}`;
      const targetForDay = s.type === "rest" ? restTargets : trainingTargets;
      const allowedMeals = (d.meals ?? []).filter((m) => {
        const hay = `${m.name} ${m.description ?? ""}`.toLowerCase();
        return !forbidden.some((f) => hay.includes(f));
      });
      return {
        name,
        meals: normalizeMealsToTargets(allowedMeals, targetForDay),
      };
    });



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

    // Scheduled window: start already computed above for weekday alignment.
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

function buildIssnCarbCyclingTargets(trainingInput: MacroTarget): { training: MacroTarget; rest: MacroTarget } {
  const training = {
    kcal: Math.max(1, Math.round(trainingInput.kcal)),
    protein_g: Math.max(1, Math.round(trainingInput.protein_g)),
    carbs_g: Math.max(1, Math.round(trainingInput.carbs_g)),
    fat_g: Math.max(1, Math.round(trainingInput.fat_g)),
  };

  // ISSN-orientiert: Protein bleibt gleich, Kohlenhydrate am Restday deutlich runter,
  // Fett leicht rauf. Kalorien ergeben sich aus den Makros und liegen dadurch niedriger.
  let rest: MacroTarget = {
    protein_g: training.protein_g,
    carbs_g: Math.max(1, Math.round(training.carbs_g * 0.65)),
    fat_g: Math.max(1, Math.round(training.fat_g * 1.1)),
    kcal: 0,
  };
  rest.kcal = Math.round(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9);

  if (rest.kcal >= training.kcal || rest.carbs_g >= training.carbs_g) {
    rest = {
      protein_g: training.protein_g,
      carbs_g: Math.max(1, Math.round(training.carbs_g * 0.55)),
      fat_g: Math.max(1, Math.round(training.fat_g * 1.05)),
      kcal: 0,
    };
    rest.kcal = Math.max(
      1,
      Math.min(training.kcal - 100, Math.round(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9)),
    );
  }

  return { training, rest };
}

function normalizeMealsToTargets(meals: GeneratedMeal[], target: MacroTarget): GeneratedMeal[] {
  if (!meals.length) return meals;
  const sums = meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + (Number(meal.kcal) || 0),
      protein_g: acc.protein_g + (Number(meal.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(meal.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(meal.fat_g) || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  const scale = (value: number, from: number, to: number) =>
    Math.max(0, Math.round(value * (to / Math.max(1, from))));
  const adjusted = meals.map((meal) => ({
    ...meal,
    kcal: scale(Number(meal.kcal) || 0, sums.kcal, target.kcal),
    protein_g: scale(Number(meal.protein_g) || 0, sums.protein_g, target.protein_g),
    carbs_g: scale(Number(meal.carbs_g) || 0, sums.carbs_g, target.carbs_g),
    fat_g: scale(Number(meal.fat_g) || 0, sums.fat_g, target.fat_g),
  }));

  const last = adjusted[adjusted.length - 1];
  last.kcal += target.kcal - adjusted.reduce((sum, meal) => sum + meal.kcal, 0);
  last.protein_g += target.protein_g - adjusted.reduce((sum, meal) => sum + meal.protein_g, 0);
  last.carbs_g += target.carbs_g - adjusted.reduce((sum, meal) => sum + meal.carbs_g, 0);
  last.fat_g += target.fat_g - adjusted.reduce((sum, meal) => sum + meal.fat_g, 0);

  return adjusted;
}

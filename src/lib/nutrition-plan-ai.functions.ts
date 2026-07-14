import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

type AiIngredient = { name: string; amount?: number; unit?: string; grams?: number };
type GeneratedMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Structured ingredient list — REQUIRED for engine compute. */
  ingredients?: AiIngredient[];
};
type ComputedGeneratedMeal = GeneratedMeal & {
  _compute_warnings?: string[];
  _data_source?: string;
  _verified_ratio?: number;
};
type GeneratedDay = { name: string; type?: "training" | "rest"; meals: GeneratedMeal[] };
type MacroTarget = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type PlanScheduleDay = { wkKey?: string; wkLabel: string; type: "training" | "rest" };
type RawPlanDay = { name: string; type: "training" | "rest"; target: MacroTarget; meals: GeneratedMeal[] };
type CleanedPlanDay = { name: string; type: "training" | "rest"; meals: ComputedGeneratedMeal[] };


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
    (d: {
      user_id: string;
      scheduled_start_date?: string | null;
      title?: string;
      /** "today" = ab heute bis nächster Einkauf, "next_shopping" = ab nächstem Einkauf für einen vollen Zyklus. */
      start_mode?: "today" | "next_shopping";
      /** Optional override: feste Plan-Länge in Tagen (1–31). Überschreibt die Einkaufstag-Logik. */
      plan_days?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const target = data.user_id;

    // Authorize: self or coach
    if (target !== userId) await assertCoachOrOrgStaffForAthlete(context, target, "nutrition");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    // Smart-Kunden dürfen sich selbst einen Plan generieren. Insert/Update auf
    // nutrition_plans ist per RLS nur Coaches erlaubt — daher hier mit
    // Admin-Client schreiben, nachdem die Autorisierung oben geprüft wurde.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return await generateAiNutritionPlanCore(supabaseAdmin, {
      target,
      uploadedBy: userId,
      scheduled_start_date: data.scheduled_start_date ?? null,
      title: data.title,
      start_mode: data.start_mode,
      plan_days: data.plan_days ?? null,
      apiKey,
    });
  });

export type GenerateNutritionPlanOpts = {
  target: string;
  uploadedBy?: string | null;
  scheduled_start_date?: string | null;
  title?: string;
  start_mode?: "today" | "next_shopping";
  plan_days?: number | null;
  apiKey: string;
};

/**
 * Kern-Generator für Smart-Ernährungspläne. Wird sowohl vom user-facing
 * Server-FN als auch vom Onboarding-Autopilot und der Verlängerungs-Logik
 * aufgerufen. Keine Authorisierung — Aufrufer ist verantwortlich.
 */
export async function generateAiNutritionPlanCore(
  supabase: any,
  opts: GenerateNutritionPlanOpts,
) {
  const { target, uploadedBy = null, apiKey } = opts;
  const data = {
    user_id: target,
    scheduled_start_date: opts.scheduled_start_date ?? null,
    title: opts.title,
    start_mode: opts.start_mode,
    plan_days: opts.plan_days ?? null,
  };
  const userId = uploadedBy ?? target;
  {

    const [
      { data: profile },
      { data: clientProfile },
      { data: latestWeight },
      { data: targets },
      { data: ratings },
      { data: favs },
      { data: skips },
      { data: swaps },
      { data: wishesData },
    ] = await Promise.all([

      supabase
        .from("smart_nutrition_profile")
        .select("*")
        .eq("user_id", target)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level, coaching_goal, training_goal")
        .eq("id", target)
        .maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", target)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(30),
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
      supabase
        .from("meal_wishes")
        .select("id, wish, applies_to")
        .eq("user_id", target)
        .eq("status", "approved")
        .is("consumed_at", null),
    ]);




    // ---- Individuelles Ziel & Körperdaten ----
    const cp: any = clientProfile ?? {};
    const weightSeries = (latestWeight as any[]) ?? [];
    const currentWeight: number | null = weightSeries[0]?.weight_kg ?? null;

    // Plateau / Trend gegen Zielrichtung erkennen (für KI-Adjustment)
    let plateauNote = "";
    if (weightSeries.length >= 2 && currentWeight != null) {
      const nowMs = Date.now();
      const olderRef = weightSeries.find((m: any) => {
        const ageDays = (nowMs - new Date(m.measured_at).getTime()) / 86400000;
        return ageDays >= 10 && ageDays <= 21 && m.weight_kg != null;
      });
      if (olderRef) {
        const diff = Number((currentWeight - olderRef.weight_kg).toFixed(2));
        const days = Math.round((nowMs - new Date(olderRef.measured_at).getTime()) / 86400000);
        const absDiff = Math.abs(diff);
        if (absDiff <= 0.3) {
          plateauNote = `⚠️ GEWICHTSPLATEAU erkannt: Gewicht stagniert seit ~${days} Tagen (Δ ${diff > 0 ? "+" : ""}${diff} kg). Passe Kalorien & Portionen um −100 bis −200 kcal/Tag an (bei Fettabbau-Ziel) bzw. +100 bis +200 kcal/Tag (bei Aufbau). Wähle bewusst sättigendere/energieärmere Alternativen (mehr Volumen, mehr Protein, weniger versteckte Fette) bzw. energiedichtere Optionen bei Aufbau. Halte die unten genannten Tagesziele weiterhin innerhalb ±5 %.`;
        }
      }
    }
    const goalWeight: number | null = cp.goal_weight_kg ?? null;
    const height: number | null = cp.height_cm ?? null;
    const gender: string | null = cp.gender ?? null;
    const ageYears: number | null = cp.birthdate
      ? Math.floor((Date.now() - new Date(cp.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    const activityLevel: string | null = cp.activity_level ?? null;
    const coachingGoal: string | null = cp.coaching_goal ?? null;
    const trainingGoal: string | null = cp.training_goal ?? null;

    // Goal direction (für KI-Promptformulierung). Die eigentlichen kcal/Makros
    // kommen aus nutrition_targets (Trigger-berechnet aus training_goal + Gewicht).
    let goalDirection: "cut" | "bulk" | "maintain" = "maintain";
    if (
      trainingGoal === "fat_loss" ||
      trainingGoal === "aggressive_cut" ||
      trainingGoal === "weight_loss" ||
      trainingGoal === "cut"
    ) {
      goalDirection = "cut";
    } else if (
      trainingGoal === "lean_bulk" ||
      trainingGoal === "muscle_gain" ||
      trainingGoal === "bulk"
    ) {
      goalDirection = "bulk";
    } else if (
      trainingGoal === "performance" ||
      trainingGoal === "recovery" ||
      trainingGoal === "maintain" ||
      trainingGoal === "recomp" ||
      trainingGoal === "health" ||
      trainingGoal === "strength" ||
      trainingGoal === "maintenance" ||
      trainingGoal === "recomposition"
    ) {
      goalDirection = "maintain";
    } else if (currentWeight && goalWeight) {
      const diff = goalWeight - currentWeight;
      if (diff <= -1) goalDirection = "cut";
      else if (diff >= 1) goalDirection = "bulk";
    } else if (coachingGoal) {
      const g = coachingGoal.toLowerCase();
      if (/(abnehm|fett|cut|diät|diet|lose)/.test(g)) goalDirection = "cut";
      else if (/(aufbau|muskel|bulk|gain|zunehm)/.test(g)) goalDirection = "bulk";
    }

    // 1. PRIMÄR: nutrition_targets (per DB-Trigger aus training_goal + Gewicht berechnet)
    // 2. FALLBACK: Mifflin-St-Jeor, falls noch keine Targets existieren
    const t = (targets as any) ?? {};
    let baseKcal: number | undefined = t.kcal ?? undefined;
    let baseProtein: number | undefined = t.protein_g ?? undefined;
    let baseCarbs: number | undefined = t.carbs_g ?? undefined;
    let baseFat: number | undefined = t.fat_g ?? undefined;
    let restKcal: number | undefined = t.kcal_rest ?? undefined;
    let restProtein: number | undefined = t.protein_g_rest ?? undefined;
    let restCarbs: number | undefined = t.carbs_g_rest ?? undefined;
    let restFat: number | undefined = t.fat_g_rest ?? undefined;

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

    // Restday-Targets: DB-Werte bevorzugen, sonst über Carb-Cycling ableiten.
    let trainingTargets = {
      kcal: baseKcal ?? 2200,
      protein_g: baseProtein ?? 150,
      carbs_g: baseCarbs ?? 240,
      fat_g: baseFat ?? 70,
    };
    let restTargets: MacroTarget;
    if (restKcal != null && restProtein != null && restCarbs != null && restFat != null) {
      restTargets = { kcal: restKcal, protein_g: restProtein, carbs_g: restCarbs, fat_g: restFat };
    } else {
      const built = buildIssnCarbCyclingTargets(trainingTargets);
      trainingTargets = built.training;
      restTargets = built.rest;
    }
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
    // Expand category words (Fisch → Lachs, Thunfisch, …) so substring filter & prompt catch all variants.
    const CATEGORY_SYNONYMS: Record<string, string[]> = {
      fisch: ["fisch", "lachs", "räucherlachs", "raeucherlachs", "thunfisch", "forelle", "kabeljau", "seelachs", "dorsch", "heilbutt", "hering", "makrele", "sardine", "sardelle", "anchovis", "wels", "zander", "barsch", "scholle", "rotbarsch", "pangasius", "tilapia"],
      meeresfrüchte: ["meeresfrüchte", "meeresfruechte", "garnele", "garnelen", "shrimp", "scampi", "krabbe", "krabben", "hummer", "muschel", "muscheln", "tintenfisch", "calamari", "oktopus"],
      schweinefleisch: ["schwein", "schweinefleisch", "schinken", "speck", "bacon", "kassler", "salami", "mortadella", "schweinefilet", "schweinebraten", "kotelett"],
      rindfleisch: ["rind", "rindfleisch", "steak", "rinderhack", "rinderfilet", "tafelspitz", "roastbeef"],
      geflügel: ["geflügel", "gefluegel", "hähnchen", "haehnchen", "huhn", "pute", "truthahn", "ente", "wachtel"],
      fleisch: ["fleisch", "hähnchen", "haehnchen", "pute", "rind", "schwein", "lamm", "wurst", "salami", "schinken", "speck", "hack", "steak", "filet"],
      milchprodukte: ["milch", "joghurt", "quark", "skyr", "käse", "kaese", "feta", "mozzarella", "parmesan", "frischkäse", "frischkaese", "hüttenkäse", "huettenkaese", "sahne", "butter"],
      nüsse: ["nuss", "nüsse", "nuesse", "mandel", "mandeln", "walnuss", "walnüsse", "haselnuss", "cashew", "pistazie", "pekan", "macadamia", "erdnuss", "erdnüsse"],
      gluten: ["weizen", "dinkel", "roggen", "gerste", "brot", "nudeln", "pasta", "couscous", "bulgur", "seitan"],
      laktose: ["milch", "joghurt", "quark", "skyr", "käse", "kaese", "sahne", "butter", "frischkäse"],
      ei: ["ei", "eier", "eiweiß", "eigelb", "omelett", "rührei", "ruehrei", "spiegelei"],
      soja: ["soja", "tofu", "tempeh", "edamame", "sojasauce", "sojamilch"],
    };
    const expandTerm = (term: string): string[] => {
      const key = term.toLowerCase().trim();
      const out = new Set<string>([key]);
      for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
        if (key === cat || key.startsWith(cat) || cat.startsWith(key)) {
          syns.forEach((s) => out.add(s));
        }
      }
      return [...out];
    };
    const expandedNogo = Array.from(new Set(nogoList.flatMap(expandTerm)));
    const expandedAllergies = Array.from(new Set(allergyList.flatMap(expandTerm)));
    const favFoods = [
      ...(p.favorite_foods ?? []),
      ...((p.extra_favorites ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const approvedWishes = ((wishesData as any[]) ?? [])
      .map((w) => w.wish as string)
      .filter(Boolean);
    const approvedWishIds = ((wishesData as any[]) ?? [])
      .map((w) => w.id as string)
      .filter(Boolean);

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
    const swapFreq: Record<string, number> = {};
    for (const n of swappedNames as string[]) {
      swapFreq[n] = (swapFreq[n] ?? 0) + 1;
    }
    const topSwapped = Object.entries(swapFreq)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8)
      .map(([n, c]) => `${n} (${c}×)`);

    const prepHint = p.meal_prep_style === "low_effort" ? "Sehr einfache Rezepte (max 15 Min)." :
      p.meal_prep_style === "meal_prep" ? "Meal-Prep-tauglich." :
      p.meal_prep_style === "2_3_week" ? "Hält 2-3 Tage." :
      p.meal_prep_style === "daily" ? "Frisch kochbar." : "";
    const weeklyBudget: number | null =
      p.weekly_budget_eur != null ? Number(p.weekly_budget_eur) : null;
    const budgetHint = p.budget_band === "<50" ? "Günstige Zutaten." :
      p.budget_band === "50_75" ? "Mittleres Budget." :
      p.budget_band === ">100" ? "Großzügiges Budget." : "";

    const equipmentList: string[] = Array.isArray(p.kitchen_equipment) ? p.kitchen_equipment : [];
    const equipmentNotes: string = (p.kitchen_equipment_notes ?? "").toString().trim();
    const equipmentLower = equipmentList.map((e) => e.toLowerCase());
    const notesLower = equipmentNotes.toLowerCase();
    const cookingDevices = ["herd", "stove", "ofen", "backofen", "oven", "airfryer", "air fryer", "heißluft", "mikrowelle", "microwave", "kochplatte", "induktion", "gas", "grill", "thermomix", "reiskocher", "wasserkocher", "kettle", "dampfgarer", "slow cooker", "instant pot", "multikocher", "pfanne", "topf"];
    const hasCookingDevice = equipmentLower.some((e) => cookingDevices.some((d) => e.includes(d)));
    const notesIndicatesNoCook = /\b(keine k(ü|ue)che|nur k(ü|ue)hlschrank|alles\s+(muss\s+)?kalt|no[- ]?cook|kein herd|kein ofen|nichts kochen|nicht kochen)\b/.test(notesLower);
    const isNoCook = (equipmentList.length > 0 || equipmentNotes.length > 0) && (!hasCookingDevice || notesIndicatesNoCook);

    const equipmentBlock = equipmentList.length || equipmentNotes
      ? `\n🍳 KÜCHENAUSSTATTUNG (HARTE EINSCHRÄNKUNG — nur Rezepte vorschlagen, die mit diesen Geräten zubereitbar sind):\n${
          equipmentList.length ? "Verfügbare Geräte: " + equipmentList.join(", ") : "(keine Liste vom Coach)"
        }${equipmentNotes ? "\nCoach-Notiz: " + equipmentNotes : ""}\nWenn z. B. KEIN HERD verfügbar ist, dürfen Rezepte nicht „in der Pfanne anbraten" o. ä. verlangen — Garmethode an Airfryer/Backofen/Mikrowelle anpassen.\n`
      : "";

    const noCookBlock = isNoCook
      ? `\n\n🧊🧊🧊 ABSOLUTE NO-COOK-REGEL (HÖCHSTE PRIORITÄT — überschreibt alle anderen Vorschläge):
Der Kunde hat KEINE Garmethode verfügbar (nur Kühlschrank / alles muss kalt aus dem Supermarkt verzehrbar sein).

❌ STRIKT VERBOTEN — auch nicht mit dem Zusatz "(kalt)" oder "vorgekocht":
- Nudeln, Reis, Kartoffeln, Quinoa, Bulgur, Couscous, Linsen-Trockenware (egal ob "gekocht, kalt" deklariert)
- Rohes Fleisch, rohes Hackfleisch, Hähnchenbrust roh, Fisch roh
- Eier (jeder Art — auch hartgekocht zählt NICHT als no-cook)
- Tiefkühlware, die aufgetaut oder gegart werden muss (TK-Gemüse, TK-Fisch, TK-Hähnchen, TK-Beeren NUR ok wenn als gefroren in Skyr/Joghurt eingerührt)
- Alles, was die Worte „gekocht", „angebraten", „gebacken", „gegrillt", „erhitzt", „aufgewärmt" enthält

✅ NUR ERLAUBT (fertig vom Supermarktregal / aus der Kühltheke):
- Aufschnitt aus der Wurst-/Kühltheke: gekochter Schinken, Putenbrust-Aufschnitt, Bresaola, Salami, Mortadella, Roastbeef-Aufschnitt
- Räucherlachs, Räucherforelle, geräucherte Makrele
- Thunfisch / Sardinen / Makrele aus der Dose
- Skyr, Quark, Naturjoghurt, griechischer Joghurt, Hüttenkäse, Frischkäse, Käse (Scheiben, Gouda, Mozzarella, Feta)
- Fertig gekochte Linsen/Kichererbsen/Bohnen/Mais aus Dose oder Beutel
- Hummus, Guacamole-Fertig, Tzatziki
- Brot, Brötchen, Wraps, Tortillas, Knäckebrot, Reiswaffeln
- Frisches Obst & Gemüse zum Rohverzehr (Salat, Gurke, Tomate, Paprika, Möhre, Apfel, Banane, Beeren)
- Salat-Fertigmischungen
- Haferflocken / Müsli als Overnight Oats (in Milch/Joghurt einweichen, NICHT kochen)
- Proteinpulver, Proteinriegel, Proteinshakes, Proteinpudding
- Beef Jerky, Nüsse, Nussmus, Trockenfrüchte
- Milch, Pflanzendrinks, Skyr-Drinks

Jede Mahlzeit MUSS aus dieser Erlaubt-Liste komponiert sein. Wenn du im Description-Feld auch nur EIN Wort wie "gekocht", "gebacken", "angebraten", "gegart" verwendest, ist der Plan FALSCH. Beispiele für gültige No-Cook-Mittagessen: „150g Putenbrust-Aufschnitt, 60g Vollkornbrot, 30g Hüttenkäse, 100g Tomate, 50g Gurke" oder „200g Thunfisch (Dose, abgetropft), 150g Kichererbsen (Dose), 100g Paprika, 50g Mais, 1 EL Olivenöl".\n`
      : "";



    // Plan length & start date.
    // Smart-Selfservice (kein plan_days übergeben): IMMER 31 Tage ab heute (1 Monat ab Kauf).
    // Coach-Generierung übergibt plan_days explizit (max 31) und überschreibt diese Regel.
    const startMode: "today" | "next_shopping" = data.start_mode ?? "today";
    const daysToNextShopping = daysUntilNextShopping(p.shopping_days);
    const start = data.scheduled_start_date
      ? new Date(data.scheduled_start_date)
      : (() => {
          const d = new Date();
          if (startMode === "next_shopping") d.setDate(d.getDate() + daysToNextShopping);
          return d;
        })();
    const overrideDays = data.plan_days != null
      ? Math.max(1, Math.min(31, Math.round(data.plan_days)))
      : null;
    // Default für Smart: 31 Tage (ca. 1 Monat ab Kaufdatum / heute).
    const planDays = overrideDays ?? 31;



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

    // Lange Pläne dürfen nicht als ein riesiger KI-Request laufen — das führt
    // zuverlässig zu 524-Timeouts. Die KI erstellt max. 7 hochwertige Basistage,
    // der Server rollt diese anschließend deterministisch auf bis zu 31 Tage aus.
    const aiPlanDays = Math.min(planDays, 7);
    const aiSchedule = schedule.slice(0, aiPlanDays);
    const trainingCount = schedule.filter((s) => s.type === "training").length;
    const restCount = schedule.length - trainingCount;
    const aiTrainingCount = aiSchedule.filter((s) => s.type === "training").length;
    const aiRestCount = aiSchedule.length - aiTrainingCount;

    const scheduleLines = aiSchedule
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

VORGEGEBENER BASIS-TAGESPLAN (wird vom Server auf ${planDays} Tage ausgerollt; Gesamtplan: ${trainingCount}× Training / ${restCount}× Rest, Basis: ${aiTrainingCount}× Training / ${aiRestCount}× Rest):
${scheduleLines}`;

    const goalLabel = goalDirection === "cut" ? "FETTABBAU (moderates Kaloriendefizit, hohes Protein)" :
      goalDirection === "bulk" ? "MUSKELAUFBAU (leichter Kalorienüberschuss, hohes Protein, ausreichend Carbs)" :
      "GEWICHT HALTEN / Recomp";

    const trainingGoalLabel: Record<string, string> = {
      muscle_gain: "Muskelaufbau",
      weight_loss: "Abnehmen / Fettabbau",
      recomp: "Recomposition (Fett↓ / Muskel↑)",
      maintain: "Gewicht halten",
      strength: "Kraftsteigerung",
      performance: "Leistungssteigerung",
      health: "Gesundheit & Wohlbefinden",
    };
    const weightDiff = currentWeight && goalWeight ? goalWeight - currentWeight : null;

    const goalBlock = `👤 INDIVIDUELLES KUNDENZIEL — Plan MUSS hierauf abgestimmt sein:
- Ausrichtung: ${goalLabel}
${trainingGoal ? `- Trainingsziel (Kunde): ${trainingGoalLabel[trainingGoal] ?? trainingGoal}` : ""}
${coachingGoal ? `- Coaching-Eigenangabe: "${coachingGoal}"` : ""}
${currentWeight ? `- Aktuelles Gewicht: ${currentWeight} kg (jüngste Messung — Portionen darauf abstimmen)` : "- Aktuelles Gewicht: unbekannt"}
${goalWeight ? `- Wunschgewicht: ${goalWeight} kg${weightDiff !== null ? ` (Differenz: ${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg → ${weightDiff < 0 ? "abnehmen" : weightDiff > 0 ? "zunehmen" : "halten"})` : ""}` : ""}
${height ? `- Größe: ${height} cm` : ""}
${ageYears ? `- Alter: ${ageYears} J.` : ""}
${gender ? `- Geschlecht: ${gender}` : ""}
${activityLevel ? `- Aktivitätslevel: ${activityLevel}` : ""}

Die Kalorien-/Makro-Ziele sind auf aktuelles Gewicht, Wunschgewicht und Trainingsziel kalibriert. Wähle Lebensmittel & Portionsgrößen, die genau dieses Ziel unterstützen: bei Abnehmen sättigend & proteinreich, bei Aufbau energiedicht mit ausreichend Carbs, bei Recomp/Halten ausgewogen.`;

    const wishesBlock = approvedWishes.length
      ? `\n⭐ COACH-FREIGEGEBENE WUNSCHGERICHTE (PFLICHT — JEDES MUSS mindestens einmal als eigenständige Mahlzeit im Plan vorkommen; der "name" der Mahlzeit muss den jeweiligen Wunsch enthalten; passe Beilagen/Portionen an die Makros an; sind es mehr Wünsche als Tage, kombiniere mehrere Wünsche pro Tag):\n${approvedWishes.map((w, i) => `  ${i + 1}. ${w}`).join("\n")}\n`
      : "";

    const budgetPerPeriod =
      weeklyBudget != null ? Math.round((weeklyBudget * planDays) / 7) : null;
    const budgetBlock = budgetPerPeriod != null
      ? `\n💶 WOCHEN-BUDGET vom Coach: ${weeklyBudget} € / Woche → für diesen ${planDays}-Tage-Plan max. ~${budgetPerPeriod} € an Lebensmittelkosten (Discounter-Preise DE). Wähle Zutaten & Mengen so, dass die Gesamteinkaufskosten dieses Budget NICHT überschreiten. Bevorzuge saisonale/günstige Proteinquellen (Hähnchenbrust, Quark, Eier, Hülsenfrüchte, Thunfisch i. W., Hackfleisch), Grundbeilagen (Reis, Haferflocken, Kartoffeln, Nudeln) und tiefgekühltes Gemüse. Premium-Zutaten (Lachs, Rindersteak, Avocado, Nüsse) sparsam einsetzen.`
      : "";

    // ---------- Safe Food Pool (geschlossener Katalog für Smart) ----------
    // Ausschließlich Lebensmittel mit safe_for_smart + is_active + verified_by_coach.
    // Die KI darf NUR text_ids aus dieser Liste in ingredients[].food_id verwenden.
    const { data: safePoolRows } = await supabase
      .from("nutrition_foods")
      .select("text_id,name,aliases")
      .eq("safe_for_smart", true)
      .eq("is_active", true)
      .eq("verified_by_coach", true)
      .order("name", { ascending: true })
      .limit(600);
    const safePool = ((safePoolRows as any[]) ?? [])
      .filter((r) => r?.text_id && r?.name)
      .map((r) => ({
        text_id: String(r.text_id),
        name: String(r.name),
        aliases: Array.isArray(r.aliases) ? (r.aliases as string[]).slice(0, 4) : [],
      }));
    const safePoolTextIds = new Set(safePool.map((f) => f.text_id));
    // Für den Prompt kompakt formatieren (text_id + kanonischer Name + wichtigste Aliase).
    const safePoolPromptLines = safePool
      .map((f) =>
        f.aliases.length
          ? `- ${f.text_id} | ${f.name} (aka ${f.aliases.slice(0, 3).join(", ")})`
          : `- ${f.text_id} | ${f.name}`,
      )
      .join("\n");
    const foodWhitelistBlock = safePoolPromptLines
      ? `\n✅ GESCHLOSSENER LEBENSMITTEL-KATALOG (SAFE FOOD POOL — HART):
Jede Zutat MUSS ein Feld "food_id" haben, dessen Wert exakt einer text_id aus dieser Liste entspricht. Keine anderen Lebensmittel — auch keine ähnlichen Synonyme, keine Marken, keine Freitext-Neuerfindungen. Wenn eine Wunsch-Zutat fehlt, wähle die nächstpassende text_id aus dieser Liste.

Format je Zeile: text_id | Kanonischer Name (aka Alias1, Alias2)
${safePoolPromptLines}
`
      : "";

    const prompt = `Erstelle eine ${aiPlanDays}-Tage-Basiswoche für einen ${planDays}-Tage-Ernährungsplan. PFLICHT pro Tag: genau 1 Frühstück (slot:"breakfast"), 1 Mittagessen (slot:"lunch"), 1 Abendessen (slot:"dinner") + mindestens 1 Snack (slot:"snack"). Diese 3 Hauptmahlzeiten sind NICHT optional — fehlt eine, ist der Plan ungültig. Der Server wiederholt passende Training-/Restday-Basistage anschließend bis Tag ${planDays}; antworte deshalb NICHT mit ${planDays} Tagen, sondern exakt mit ${aiPlanDays} Basistagen.

🚨 KALORIEN-OBERGRENZE PRO MAHLZEIT: 850 kcal (HART). Keine einzelne Mahlzeit darf 850 kcal überschreiten — auch nicht Frühstück, Mittag oder Abend. Wenn das Tages-kcal-Ziel mit 4 Mahlzeiten nicht erreicht wird, FÜGE WEITERE SNACKS HINZU (Snack 2, Snack 3, …), bis das Tagesziel erreicht ist. Lieber 5–7 kleinere Mahlzeiten als 3–4 zu große. Verteile Kalorien gleichmäßig: typisch Hauptmahlzeiten 500–800 kcal, Snacks 150–400 kcal.

🎯 ZIELWERTE EXAKT TREFFEN: Tages-kcal innerhalb ±3 %, Protein/Kohlenhydrate/Fett jeweils innerhalb ±5 g der Vorgaben. Plane Portionsgrößen mathematisch so, dass die Summe der Mahlzeiten möglichst genau den Tageszielen entspricht — nicht überschreiten, nicht unterschreiten.
${noCookBlock}

${plateauNote ? "\n" + plateauNote + "\n" : ""}
${goalBlock}

${targetsBlock}


🚨 ABSOLUTE AUSSCHLÜSSE — niemals verwenden (Kategorien gelten für ALLE Varianten, inkl. geräuchert/getrocknet/eingelegt/pulver/-mehl/-milch):
${allergyList.length ? "ALLERGIEN: " + allergyList.join(", ") + (expandedAllergies.length > allergyList.length ? " — gilt auch für: " + expandedAllergies.filter(t => !allergyList.map(a=>a.toLowerCase()).includes(t)).join(", ") : "") : "(keine)"}
${nogoList.length ? "NO-GO: " + nogoList.join(", ") + (expandedNogo.length > nogoList.length ? " — gilt auch für: " + expandedNogo.filter(t => !nogoList.map(a=>a.toLowerCase()).includes(t)).join(", ") : "") : "(keine)"}
${p.diet_style ? `ERNÄHRUNGSFORM (HART): ${p.diet_style}${p.diet_style === "vegan" ? " — KEINE tierischen Produkte (kein Fleisch, Fisch, Ei, Milch, Käse, Quark, Skyr, Joghurt, Butter, Honig)." : p.diet_style === "vegetarian" ? " — KEIN Fleisch, KEIN Fisch/Meeresfrüchte. Milchprodukte und Eier erlaubt." : p.diet_style === "pescetarian" ? " — KEIN Fleisch (Rind/Schwein/Geflügel/Lamm/Wild). Fisch, Meeresfrüchte, Milch, Eier erlaubt." : p.diet_style === "flexitarian" ? " — überwiegend pflanzlich, Fleisch/Fisch nur sparsam." : ""}` : ""}
${p.diet_notes ? "ERNÄHRUNGS-DETAILS: " + p.diet_notes : ""}


KUNDEN-VORLIEBEN (priorisieren):
${favFoods.length ? "Lieblings-Foods: " + favFoods.join(", ") : ""}
${favoriteNames.length ? "Favorisierte Rezepte: " + favoriteNames.slice(0, 10).join(", ") : ""}
${liked.length ? "Mag (4-5★): " + liked.slice(0, 10).join(", ") : ""}
${disliked.length ? "Mag NICHT — vermeiden: " + disliked.slice(0, 10).join(", ") : ""}
${topSwapped.length ? "Häufig getauscht (lieber meiden): " + topSwapped.join(", ") : ""}
${skipReasons.length ? "Häufig übersprungen: " + skipReasons.slice(0, 8).join("; ") : ""}
${wishesBlock}${budgetBlock}${equipmentBlock}${foodWhitelistBlock}
${prepHint} ${budgetHint}



Antworte AUSSCHLIESSLICH mit gültigem JSON in folgender Form:
{"days":[{"name":"Tag 1","type":"training","meals":[{"slot":"breakfast","name":"Overnight Oats","description":"80g Haferflocken, 250ml Milch 1,5%, 150g Skyr natur, 100g Beeren gemischt, 15g Chia-Samen, 15g Mandeln","ingredients":[{"food_id":"haferflocken","name":"Haferflocken","amount":80,"unit":"g"},{"food_id":"milch_1_5","name":"Milch 1,5%","amount":250,"unit":"ml","grams":250},{"food_id":"skyr_natur","name":"Skyr natur","amount":150,"unit":"g"},{"food_id":"beeren_gemischt","name":"Beeren gemischt","amount":100,"unit":"g"},{"food_id":"chia_samen","name":"Chia-Samen","amount":15,"unit":"g"},{"food_id":"mandeln","name":"Mandeln","amount":15,"unit":"g"}],"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}]}]}

🧮 STRUKTURIERTE ZUTATEN SIND PFLICHT — die Berechnung läuft ausschließlich über food_id + Gramm:
- Jede Mahlzeit MUSS ein "ingredients"-Array enthalten, mit JEDER einzelnen Zutat aus der Description.
- Jede Zutat MUSS ein Feld "food_id" haben — der Wert ist eine text_id aus dem GESCHLOSSENEN LEBENSMITTEL-KATALOG oben. Keine Ausnahme.
- Zusätzlich: "name" (Anzeige-Name, darf der kanonische Name sein), "amount" (Zahl) und "unit" (g, ml, EL, TL, Stück). Bei Stück/Scheibe/EL/TL MUSS zusätzlich "grams" mit dem Gesamtgewicht angegeben werden.
- "amount" + "unit" müssen genau zur Mengenangabe im Description-Text passen.
- Nährwerte ("kcal","protein_g","carbs_g","fat_g") IMMER auf 0 setzen — der Server berechnet sie deterministisch aus food_id + Gramm. Schätze NIEMALS selbst.
- Wasser, Gewürze, Salz, Pfeffer, Zimt: in "ingredients" mit amount:0 oder unit:"prise" angeben (zählen nicht in die Makros). food_id ist trotzdem Pflicht, sofern im Katalog vorhanden — sonst weglassen.

❌ Wenn du eine Zutat verwendest, deren food_id NICHT im Katalog steht, wird die gesamte Mahlzeit verworfen und ggf. der Plan zur Coach-Prüfung markiert.

Genau ${aiPlanDays} Basistage in der vorgegebenen Reihenfolge, mindestens 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack), bei Bedarf zusätzliche Snacks ergänzen. KEINE Mahlzeit über 850 kcal. Jeder Tag MUSS ein Feld "type" mit "training" ODER "rest" enthalten (passend zum Basis-Tagesplan oben). Tagessummen müssen die jeweiligen Ziele treffen.

WICHTIG zu name/description:
- "name" = konkreter Gerichtsname (z. B. Overnight Oats, Hähnchen-Reis-Bowl).
- "description" = NUR kommagetrennte Zutaten mit Mengen für die Anzeige (z. B. 80g Haferflocken, 250ml Milch). NIEMALS Zubereitungsanweisungen.
- JEDE Zutat MUSS eine konkrete Menge in g, ml, Stück oder EL/TL haben — NIEMALS "Portion", "etwas", "nach Geschmack" o. ä. Auch Salat, Gemüse, Beilagen und Toppings IMMER in Gramm angeben (z. B. "150g Blattsalat", "200g Brokkoli", "30g Feldsalat").`;



    const {
      computeMealFromIngredients,
      computeMealFromDescription,
      coerceIngredients,
      isUsableEngineResult,
      parseDescriptionToEngineIngredients,
    } = await import("./nutrition-engine.server");

    const forbidden = [...expandedAllergies, ...expandedNogo]
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);

    // Gemini 2.5-flash liefert bei langen Prompts (großer Food-Katalog) gelegentlich
    // eine reine Whitespace-Antwort ohne JSON. In dem Fall auf ein anderes Modell fallbacken.
    const MODEL_CANDIDATES = [
      "google/gemini-2.5-flash",
      "openai/gpt-5.5-mini",
      "google/gemini-2.5-pro",
    ] as const;

    async function callModel(model: string, finalPrompt: string): Promise<string> {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: finalPrompt }],
        }),
      });
      if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
      if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
      if (!aiRes.ok) {
        const txt = await aiRes.text();
        throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
      }
      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
      return typeof raw === "string" ? raw : JSON.stringify(raw);
    }

    async function runAiAttempt(correctionNote: string): Promise<GeneratedDay[]> {
      const finalPrompt = correctionNote ? `${prompt}\n\n${correctionNote}` : prompt;
      let lastError: Error | null = null;
      for (const model of MODEL_CANDIDATES) {
        try {
          const raw = await callModel(model, finalPrompt);
          if (!raw.trim() || !raw.includes("{")) {
            lastError = new Error(`Leere Antwort von ${model}`);
            continue;
          }
          let parsed: { days?: GeneratedDay[] } = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            lastError = new Error(`Antwort von ${model} konnte nicht gelesen werden.`);
            continue;
          }
          const generatedDays = (parsed.days ?? [])
            .slice(0, aiPlanDays)
            .map((d: GeneratedDay, i: number): GeneratedDay => ({ ...d, type: aiSchedule[i]?.type ?? d.type }));
          if (!generatedDays.length) {
            lastError = new Error(`Keine Tage von ${model}.`);
            continue;
          }
          return generatedDays;
        } catch (e) {
          const msg = (e as Error).message ?? "";
          if (msg.startsWith("Rate-Limit") || msg.startsWith("Guthaben")) throw e;
          lastError = e as Error;
        }
      }
      throw lastError ?? new Error("Keine Tage generiert.");
    }

    // Auto-Repair-Schleife: bis zu 2 Retries, falls die KI food_ids liefert,
    // die nicht im Safe-Pool sind. Beim Retry bekommt die KI eine konkrete
    // Fehlerliste + die Anweisung, ausschließlich text_ids aus dem Pool zu nutzen.
    const MAX_ATTEMPTS = 3;
    let lastCleaned: CleanedPlanDay[] | null = null;
    let lastUnresolved: Array<{ day: string; meal: string; name: string; food_id: string | null }> = [];
    let correctionNote = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const generatedDays = await runAiAttempt(correctionNote);
      const days: GeneratedDay[] = expandGeneratedDays(generatedDays, schedule, planDays);

      const rawDays: RawPlanDay[] = days.map((d: GeneratedDay, i: number): RawPlanDay => {
        const s = schedule[i] ?? schedule[schedule.length - 1];
        const typeLabel = s.type === "rest" ? "Restday" : "Trainingstag";
        const name = `${s.wkLabel} — ${typeLabel}`;
        const allowedMeals = (d.meals ?? []).filter((m: GeneratedMeal) => {
          const hay = `${m.name} ${m.description ?? ""} ${JSON.stringify((m as any).ingredients ?? [])}`.toLowerCase();
          return !containsForbiddenFood(hay, forbidden);
        });
        return {
          name,
          type: s.type,
          target: s.type === "rest" ? restTargets : trainingTargets,
          meals: allowedMeals,
        };
      });

      const repairedRawDays = rawDays.map((d: RawPlanDay): RawPlanDay => ({
        ...d,
        meals: ensureRequiredMealSlots(d.meals, d.type, d.target, forbidden, isNoCook),
      }));

      const missingRequired = repairedRawDays.flatMap((d: RawPlanDay, idx: number) => {
        const slots = new Set(d.meals.map((m: GeneratedMeal) => m.slot));
        return (["breakfast", "lunch", "dinner"] as const)
          .filter((slot) => !slots.has(slot))
          .map((slot) => `Tag ${idx + 1}: ${labelForSlot(slot)} fehlt`);
      });
      if (missingRequired.length && attempt >= MAX_ATTEMPTS) {
        throw new Error(`Plan unvollständig: ${missingRequired.slice(0, 6).join("; ")}.`);
      }
      if (missingRequired.length) {
        correctionNote = `⚠️ RETRY (${attempt}/${MAX_ATTEMPTS - 1}): Es fehlten Pflicht-Mahlzeiten: ${missingRequired.join("; ")}. Bitte JETZT wirklich für JEDEN Basistag Frühstück + Mittag + Abend + mind. 1 Snack liefern.`;
        continue;
      }

      // ---- Compute meals in tolerant mode (Smart-Pool + resolved-ID pflicht) ----
      const attemptUnresolved: typeof lastUnresolved = [];
      const baseCache = new Map<string, Promise<ComputedGeneratedMeal[]>>();

      const computeDayMeals = async (d: RawPlanDay, dayIdx: number): Promise<ComputedGeneratedMeal[]> => {
        const computed = await Promise.all(d.meals.map(async (m: GeneratedMeal) => {
          const structured = coerceIngredients((m as any).ingredients ?? null);
          const ingredientsForMath = structured.length
            ? structured
            : parseDescriptionToEngineIngredients(m.description ?? null);
          const result = structured.length
            ? await computeMealFromIngredients(supabase, structured, { smartOnly: true, requireResolvedIds: true })
            : await computeMealFromDescription(supabase, m.description ?? null, { smartOnly: true, requireResolvedIds: true });

          const unresolved = (result?.unresolved_ingredients ?? []) as Array<{ name: string; food_id?: string | null; grams: number }>;
          for (const u of unresolved) {
            attemptUnresolved.push({ day: d.name, meal: m.name, name: u.name, food_id: u.food_id ?? null });
          }

          const usable = isUsableEngineResult(result);
          const kcal = usable ? result!.kcal : 0;
          const protein_g = usable ? result!.protein_g : 0;
          const carbs_g = usable ? result!.carbs_g : 0;
          const fat_g = usable ? result!.fat_g : 0;

          return {
            ...m,
            ingredients: ingredientsForMath,
            kcal,
            protein_g,
            carbs_g,
            fat_g,
            _compute_warnings: result?.warnings ?? [],
            _data_source: result?.data_source ?? "ai_estimate",
            _verified_ratio: result?.coverage ?? 0,
          } as ComputedGeneratedMeal;
        }));

        let capped = splitOversizedMeals(computed);
        const daySums = capped.reduce(
          (acc: MacroTarget, meal: ComputedGeneratedMeal) => ({
            kcal: acc.kcal + (Number(meal.kcal) || 0),
            protein_g: acc.protein_g + (Number(meal.protein_g) || 0),
            carbs_g: acc.carbs_g + (Number(meal.carbs_g) || 0),
            fat_g: acc.fat_g + (Number(meal.fat_g) || 0),
          }),
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        );
        capped = await addDeterministicCorrectionSnacks(capped, d.target, daySums, supabase, computeMealFromIngredients, isUsableEngineResult, forbidden);
        const finalSums = capped.reduce(
          (acc: MacroTarget, meal: ComputedGeneratedMeal) => ({
            kcal: acc.kcal + (Number(meal.kcal) || 0),
            protein_g: acc.protein_g + (Number(meal.protein_g) || 0),
            carbs_g: acc.carbs_g + (Number(meal.carbs_g) || 0),
            fat_g: acc.fat_g + (Number(meal.fat_g) || 0),
          }),
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        );
        const kcalDiff = Math.abs(finalSums.kcal - d.target.kcal) / Math.max(1, d.target.kcal);
        const macroOff =
          Math.abs(finalSums.protein_g - d.target.protein_g) > 20 ||
          Math.abs(finalSums.carbs_g - d.target.carbs_g) > 30 ||
          Math.abs(finalSums.fat_g - d.target.fat_g) > 20;
        if (kcalDiff > 0.15 || macroOff) {
          console.warn("Nutrition plan target deviation", { day: dayIdx + 1, target: d.target, actual: finalSums });
        }
        return capped;
      };

      const cleaned: CleanedPlanDay[] = await Promise.all(repairedRawDays.map(async (d: RawPlanDay, dayIdx: number): Promise<CleanedPlanDay> => {
        const cacheKey = `${d.type}:${JSON.stringify(d.meals)}`;
        let cached = baseCache.get(cacheKey);
        if (!cached) {
          cached = computeDayMeals(d, dayIdx);
          baseCache.set(cacheKey, cached);
        }
        const meals = (await cached).map(cloneComputedMealForExpandedDay);
        return { name: d.name, type: d.type, meals };
      }));

      lastCleaned = cleaned;
      lastUnresolved = attemptUnresolved;

      if (attemptUnresolved.length === 0) break;

      if (attempt < MAX_ATTEMPTS) {
        const uniqueBad = Array.from(new Set(attemptUnresolved.map((u) => `${u.name}${u.food_id ? ` (food_id="${u.food_id}")` : ""}`))).slice(0, 20);
        correctionNote = `⚠️ RETRY ${attempt}/${MAX_ATTEMPTS - 1}: Folgende Zutaten waren im vorherigen Versuch NICHT im geschlossenen Lebensmittel-Katalog:\n- ${uniqueBad.join("\n- ")}\n\nBitte generiere den Plan komplett neu und verwende AUSSCHLIESSLICH text_ids aus dem SAFE FOOD POOL oben. Jede Zutat MUSS ein Feld "food_id" mit einer text_id aus der Liste haben. Wähle die nächstpassende Alternative für die oben genannten Zutaten.`;
      }
    }

    const cleaned = lastCleaned!;
    const hasUnresolved = lastUnresolved.length > 0;




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
    const avgKcal = roundKcal50(sums.kcal / totalDays);
    const avgP = Math.round(sums.p / totalDays);
    const avgC = Math.round(sums.c / totalDays);
    const avgF = Math.round(sums.f / totalDays);

    // Scheduled window: start already computed above for weekday alignment.
    const end = new Date(start);
    end.setDate(end.getDate() + totalDays - 1);
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);


    // Plan-Status: needs_review, sobald mind. eine Zutat NICHT eindeutig auf
    // eine food_id/text_id aus dem Safe-Pool aufgelöst werden konnte.
    // Ein needs_review-Plan wird NICHT aktiviert und der Coach bekommt einen Alert.
    const planStatus: "draft" | "needs_review" = hasUnresolved ? "needs_review" : "draft";
    const planTitleBase = data.title?.trim() || `Smart-Plan — ${new Date().toLocaleDateString("de-DE")}`;
    const planTitle = hasUnresolved ? `${planTitleBase} (Prüfung nötig)` : planTitleBase;

    const { data: planRow, error: planErr } = await supabase
      .from("nutrition_plans")
      .insert({
        client_id: target,
        title: planTitle,
        plan_type: "nutrition",
        is_active: false,
        status: planStatus,
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

    // Insert days & meals — Werte sind bereits vorab von der Engine berechnet.
    for (let i = 0; i < cleaned.length; i++) {
      const d = cleaned[i];
      const { data: dayRow, error: dErr } = await supabase
        .from("nutrition_plan_days")
        .insert({ plan_id: planRow.id, name: d.name, sort_order: i })
        .select("id")
        .single();
      if (dErr || !dayRow) continue;
      let snackCounter = 0;

      const mealRows = d.meals.map((m: ComputedGeneratedMeal, idx: number) => {
        let slotLabel: string;
        if (m.slot === "breakfast") slotLabel = "Frühstück";
        else if (m.slot === "lunch") slotLabel = "Mittagessen";
        else if (m.slot === "dinner") slotLabel = "Abendessen";
        else {
          snackCounter += 1;
          slotLabel = `Snack ${snackCounter}`;
        }
        const kcal: number | null = m.kcal ?? null;
        const protein_g: number | null = m.protein_g ?? null;
        const carbs_g: number | null = m.carbs_g ?? null;
        const fat_g: number | null = m.fat_g ?? null;
        const data_source = (m as any)._data_source ?? "db_verified";
        const verified_ratio: number = (m as any)._verified_ratio ?? 1;
        const warnings: string[] = (m as any)._compute_warnings ?? [];
        const structuredIngredients = coerceIngredients((m as any).ingredients ?? null);

        return {
          day_id: dayRow.id,
          name: `${d.name} — ${slotLabel}`,
          description: m.description ?? null,
          ingredients_json: structuredIngredients.length ? structuredIngredients : null,
          compute_warnings: warnings,
          kcal,
          protein_g,
          carbs_g,
          fat_g,
          sort_order: idx,
          data_source,
          verified_ratio,
        };
      });
      if (mealRows.length) {
        await supabase.from("nutrition_plan_meals").insert(mealRows);
      }
    }

    // Auto-generate shopping list — nur bei einem sauber aufgelösten Plan.
    // needs_review-Pläne bekommen KEINE Einkaufsliste, da Zutaten unklar sind.
    if (!hasUnresolved) {
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
    }

    // Only mark wishes as consumed when the AI actually used them in the plan;
    // unused wishes stay pending so they roll into the next plan.
    if (approvedWishIds.length && !hasUnresolved) {
      const haystack = cleaned
        .flatMap((d) => d.meals.map((m: ComputedGeneratedMeal) => `${m.name} ${m.description ?? ""}`))
        .join(" | ")
        .toLowerCase();
      const norm = (s: string) =>
        s.toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").trim();
      const usedIds: string[] = [];
      (wishesData as any[] | null | undefined)?.forEach((w) => {
        const key = norm(String(w.wish ?? ""));
        if (key && haystack.includes(key)) usedIds.push(w.id as string);
      });
      if (usedIds.length) {
        await supabase
          .from("meal_wishes")
          .update({ consumed_at: new Date().toISOString() })
          .in("id", usedIds);
      }
    }

    // Coach-Alert für needs_review-Pläne (unabhängig vom individuellen Coach).
    // Wir schreiben eine coach_task_state-Zeile pro Coach, damit sie im Dashboard auftaucht.
    if (hasUnresolved) {
      try {
        const uniqueBad = Array.from(
          new Set(lastUnresolved.map((u) => `${u.meal}: „${u.name}"${u.food_id ? ` (food_id="${u.food_id}")` : ""}`)),
        ).slice(0, 15);
        const note = `Smart-Plan ${planRow.id} wurde als NEEDS_REVIEW gespeichert. Zutaten ohne eindeutige food_id im Safe-Pool:\n- ${uniqueBad.join("\n- ")}`;
        const { data: coachRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "coach");
        const rows = ((coachRoles as any[] | null) ?? []).map((r) => ({
          coach_id: r.user_id,
          task_key: `plan_needs_review:${planRow.id}`,
          note,
        }));
        if (rows.length) {
          await supabase.from("coach_task_state").upsert(rows, { onConflict: "coach_id,task_key" });
        }
      } catch (e) {
        console.warn("coach_task_state alert failed:", e);
      }
    }

    return {
      ok: true,
      plan_id: planRow.id,
      status: planStatus,
      needs_review: hasUnresolved,
      unresolved: hasUnresolved
        ? lastUnresolved.slice(0, 20).map((u) => ({ meal: u.meal, name: u.name, food_id: u.food_id }))
        : [],
      days: cleaned.length,
      meals: cleaned.reduce((s, d) => s + d.meals.length, 0),
      avg_kcal: avgKcal,
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
    };
  }
}


function labelForSlot(slot: string): string {
  switch (slot) {
    case "breakfast": return "Frühstück";
    case "lunch": return "Mittagessen";
    case "dinner": return "Abendessen";
    case "snack": return "Snack";
    default: return "Mahlzeit";
  }
}

function cloneMealForExpandedDay(meal: GeneratedMeal): GeneratedMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ing) => ({ ...ing }))
      : undefined,
  };
}

function cloneComputedMealForExpandedDay(meal: ComputedGeneratedMeal): ComputedGeneratedMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ing) => ({ ...ing }))
      : undefined,
    _compute_warnings: Array.isArray(meal._compute_warnings) ? [...meal._compute_warnings] : undefined,
  };
}

function expandGeneratedDays(
  baseDays: GeneratedDay[],
  schedule: PlanScheduleDay[],
  planDays: number,
): GeneratedDay[] {
  const fallbackDays = baseDays.length ? baseDays : [{ name: "Tag 1", type: "training" as const, meals: [] }];
  const pools: Record<"training" | "rest", GeneratedDay[]> = {
    training: fallbackDays.filter((d) => d.type === "training"),
    rest: fallbackDays.filter((d) => d.type === "rest"),
  };
  const counters: Record<"training" | "rest", number> = { training: 0, rest: 0 };

  return Array.from({ length: planDays }, (_, i): GeneratedDay => {
    const type = schedule[i]?.type ?? fallbackDays[i % fallbackDays.length]?.type ?? "training";
    const pool = pools[type].length ? pools[type] : fallbackDays;
    const template = pool[counters[type] % pool.length] ?? fallbackDays[i % fallbackDays.length];
    counters[type] += 1;
    return {
      name: `Tag ${i + 1}`,
      type,
      meals: (template.meals ?? []).map(cloneMealForExpandedDay),
    };
  });
}

/** Auf 50-kcal-Schritte runden (z. B. 2237 → 2250). */
function roundKcal50(value: number): number {
  return Math.max(0, Math.round(value / 50) * 50);
}

function buildIssnCarbCyclingTargets(trainingInput: MacroTarget): { training: MacroTarget; rest: MacroTarget } {
  const training = {
    kcal: Math.max(50, roundKcal50(trainingInput.kcal)),
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
  rest.kcal = roundKcal50(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9);

  if (rest.kcal >= training.kcal || rest.carbs_g >= training.carbs_g) {
    rest = {
      protein_g: training.protein_g,
      carbs_g: Math.max(1, Math.round(training.carbs_g * 0.55)),
      fat_g: Math.max(1, Math.round(training.fat_g * 1.05)),
      kcal: 0,
    };
    rest.kcal = Math.max(
      50,
      Math.min(training.kcal - 100, roundKcal50(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9)),
    );
  }

  return { training, rest };
}


const MAX_KCAL_PER_MEAL = 850;

function splitOversizedMeals(meals: ComputedGeneratedMeal[]): ComputedGeneratedMeal[] {
  const capped: ComputedGeneratedMeal[] = [];
  for (const m of meals) {
    const k = Number(m.kcal) || 0;
    if (k <= MAX_KCAL_PER_MEAL) {
      capped.push(m);
      continue;
    }
    const parts = Math.ceil(k / MAX_KCAL_PER_MEAL);
    const sourceIngredients = Array.isArray(m.ingredients) ? (m.ingredients as any[]) : [];
    for (let i = 0; i < parts; i++) {
      const ingredients = sourceIngredients.map((ing) => {
        const grams = Number(ing.grams ?? ing.amount_g ?? ing.amount) || 0;
        const splitGrams = Math.max(0, Math.round((grams / parts) * 10) / 10);
        return { name: ing.name, amount: splitGrams, unit: "g", grams: splitGrams };
      });
      capped.push({
        ...m,
        slot: i === 0 ? m.slot : "snack",
        name: parts > 1 ? `${m.name} (Portion ${i + 1}/${parts})` : m.name,
        description: ingredients.length ? describeIngredients(ingredients) : m.description,
        ingredients,
        kcal: Math.round(k / parts),
        protein_g: Math.round((Number(m.protein_g) || 0) / parts),
        carbs_g: Math.round((Number(m.carbs_g) || 0) / parts),
        fat_g: Math.round((Number(m.fat_g) || 0) / parts),
      });
    }
  }
  return capped;
}

async function addDeterministicCorrectionSnacks(
  meals: ComputedGeneratedMeal[],
  target: MacroTarget,
  current: MacroTarget,
  supabase: any,
  computeMealFromIngredients: (supabase: any, ingredients: any[]) => Promise<any>,
  isUsableEngineResult: (result: any) => boolean,
  forbidden: string[] = [],
): Promise<ComputedGeneratedMeal[]> {
  const result = [...meals];
  const addSnack = async (label: string, ingredients: AiIngredient[]) => {
    const hay = `${label} ${JSON.stringify(ingredients)}`.toLowerCase();
    if (containsForbiddenFood(hay, forbidden)) return;
    const computed = await computeMealFromIngredients(supabase, ingredients);
    if (!isUsableEngineResult(computed) || computed.kcal < 50 || computed.kcal > MAX_KCAL_PER_MEAL) return;
    result.push({
      slot: "snack",
      name: label,
      description: describeIngredients(ingredients as any),
      ingredients,
      kcal: computed.kcal,
      protein_g: computed.protein_g,
      carbs_g: computed.carbs_g,
      fat_g: computed.fat_g,
      _data_source: computed.data_source,
      _verified_ratio: computed.coverage,
      _compute_warnings: ["Automatisch ergänzt, damit Tagesziel näher getroffen wird.", ...(computed.warnings ?? [])],
    });
    current.kcal += computed.kcal;
    current.protein_g += computed.protein_g;
    current.carbs_g += computed.carbs_g;
    current.fat_g += computed.fat_g;
  };

  const kcalGap = target.kcal - current.kcal;
  const proteinGap = target.protein_g - current.protein_g;
  if (proteinGap > 12 && kcalGap > 80) {
    const grams = Math.min(300, Math.max(100, Math.round((proteinGap / 11) * 100)));
    await addSnack(
      "Skyr-Protein-Snack",
      [{ name: "Skyr", amount: grams, unit: "g", grams }],
    );
  }

  const remainingKcal = target.kcal - current.kcal;
  const carbGap = target.carbs_g - current.carbs_g;
  if ((carbGap > 18 || remainingKcal > 180) && remainingKcal > 90) {
    const grams = Math.min(120, Math.max(30, Math.round((Math.min(carbGap, remainingKcal / 4) / 58.7) * 100)));
    await addSnack(
      "Haferflocken-Snack",
      [{ name: "Haferflocken", amount: grams, unit: "g", grams }],
    );
  }

  const finalGap = target.kcal - current.kcal;
  const fatGap = target.fat_g - current.fat_g;
  if (fatGap > 8 && finalGap > 90) {
    const grams = Math.min(30, Math.max(10, Math.round(fatGap / 0.5)));
    await addSnack(
      "Mandel-Snack",
      [{ name: "Mandeln", amount: grams, unit: "g", grams }],
    );
  }

  return result;
}

function ensureRequiredMealSlots(
  meals: GeneratedMeal[],
  dayType: "training" | "rest",
  target: MacroTarget,
  forbidden: string[],
  isNoCook: boolean,
): GeneratedMeal[] {
  const result = [...meals];
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    if (result.some((meal) => meal.slot === slot)) continue;
    result.push(chooseRequiredSlotFallback(slot, dayType, target, forbidden, isNoCook));
  }
  if (!result.some((meal) => meal.slot === "snack")) {
    result.push(chooseRequiredSlotFallback("snack", dayType, target, forbidden, isNoCook));
  }
  return sortMealsBySlot(result);
}

function chooseRequiredSlotFallback(
  slot: GeneratedMeal["slot"],
  dayType: "training" | "rest",
  target: MacroTarget,
  forbidden: string[],
  isNoCook: boolean,
): GeneratedMeal {
  const kcalScale = Math.max(0.75, Math.min(1.25, target.kcal / (dayType === "training" ? 2400 : 1900)));
  const g = (value: number) => Math.max(5, Math.round(value * kcalScale));
  const candidates: GeneratedMeal[] = [];

  if (slot === "breakfast") {
    candidates.push(makeMeal("breakfast", "Skyr-Hafer-Beeren-Bowl", [
      { name: "Skyr natur", grams: g(300) },
      { name: "Haferflocken", grams: g(60) },
      { name: "Beeren gemischt", grams: g(100) },
      { name: "Mandeln", grams: g(15) },
    ]));
    candidates.push(makeMeal("breakfast", "Haferflocken-Bananen-Bowl", [
      { name: "Haferflocken", grams: g(80) },
      { name: "Banane", grams: g(120) },
      { name: "Beeren gemischt", grams: g(100) },
    ]));
  } else if (slot === "lunch") {
    if (isNoCook) {
      candidates.push(makeMeal("lunch", "Putenbrust-Vollkornbrot-Teller", [
        { name: "Putenbrust Aufschnitt", grams: g(160) },
        { name: "Brot Vollkorn (Roggen)", grams: g(120) },
        { name: "Gurke", grams: g(150) },
        { name: "Tomaten", grams: g(150) },
        { name: "Frischkäse light", grams: g(40) },
      ]));
    } else {
      candidates.push(makeMeal("lunch", "Hähnchen-Reis-Brokkoli-Bowl", [
        { name: "Hähnchenbrust, gegart", grams: g(180) },
        { name: "Reis weiß, langkorn, gekocht", grams: g(250) },
        { name: "Brokkoli", grams: g(200) },
        { name: "Olivenöl", grams: g(10) },
      ]));
    }
    candidates.push(makeMeal("lunch", "Reis-Brokkoli-Olivenöl-Bowl", [
      { name: "Reis weiß, langkorn, gekocht", grams: g(300) },
      { name: "Brokkoli", grams: g(250) },
      { name: "Olivenöl", grams: g(15) },
    ]));
    candidates.push(makeMeal("lunch", "Kartoffel-Gemüse-Teller", [
      { name: "Kartoffeln, gekocht", grams: g(350) },
      { name: "Brokkoli", grams: g(250) },
      { name: "Olivenöl", grams: g(15) },
    ]));
  } else if (slot === "dinner") {
    if (isNoCook) {
      candidates.push(makeMeal("dinner", "Skyr-Brot-Gemüse-Teller", [
        { name: "Skyr natur", grams: g(300) },
        { name: "Brot Vollkorn (Roggen)", grams: g(100) },
        { name: "Gurke", grams: g(150) },
        { name: "Tomaten", grams: g(150) },
        { name: "Mandeln", grams: g(15) },
      ]));
    } else {
      candidates.push(makeMeal("dinner", "Puten-Kartoffel-Gemüse-Teller", [
        { name: "Putenbrust gegart", grams: g(180) },
        { name: "Kartoffeln, gekocht", grams: g(300) },
        { name: "Paprika gelb", grams: g(150) },
        { name: "Olivenöl", grams: g(10) },
      ]));
    }
    candidates.push(makeMeal("dinner", "Kartoffel-Brokkoli-Olivenöl-Teller", [
      { name: "Kartoffeln, gekocht", grams: g(350) },
      { name: "Brokkoli", grams: g(250) },
      { name: "Olivenöl", grams: g(15) },
    ]));
  } else {
    candidates.push(makeMeal("snack", "Skyr-Protein-Snack", [{ name: "Skyr natur", grams: g(250) }]));
    candidates.push(makeMeal("snack", "Haferflocken-Snack", [{ name: "Haferflocken", grams: g(50) }]));
    candidates.push(makeMeal("snack", "Bananen-Snack", [{ name: "Banane", grams: g(150) }]));
  }

  const allowed = candidates.find((meal) => !containsForbiddenFood(`${meal.name} ${meal.description}`, forbidden));
  if (allowed) return allowed;

  // Fail-safe: Even with very broad No-Go categories, never create an incomplete
  // Smart plan. Use simple fruit/carb fallbacks that are fully DB-backed and
  // still respect the same forbidden-word matcher as far as possible.
  if (slot === "breakfast") return makeMeal("breakfast", "Haferflocken-Bowl", [{ name: "Haferflocken", grams: g(90) }]);
  if (slot === "lunch") return makeMeal("lunch", "Reis-Olivenöl-Teller", [
    { name: "Reis weiß, langkorn, gekocht", grams: g(320) },
    { name: "Olivenöl", grams: g(15) },
  ]);
  if (slot === "dinner") return makeMeal("dinner", "Kartoffel-Olivenöl-Teller", [
    { name: "Kartoffeln, gekocht", grams: g(400) },
    { name: "Olivenöl", grams: g(15) },
  ]);
  return makeMeal("snack", "Bananen-Snack", [{ name: "Banane", grams: g(150) }]);
}

function makeMeal(
  slot: GeneratedMeal["slot"],
  name: string,
  ingredients: Array<{ name: string; grams: number }>,
): GeneratedMeal {
  const normalizedIngredients = ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.grams,
    unit: "g",
    grams: ing.grams,
  }));
  return {
    slot,
    name,
    description: describeIngredients(normalizedIngredients),
    ingredients: normalizedIngredients,
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
}

function sortMealsBySlot<T extends { slot: GeneratedMeal["slot"] }>(meals: T[]): T[] {
  const order: Record<GeneratedMeal["slot"], number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  return [...meals].sort((a, b) => order[a.slot] - order[b.slot]);
}

function containsForbiddenFood(haystack: string, forbidden: string[]): boolean {
  const hay = haystack.toLowerCase();
  return forbidden.some((raw) => {
    const term = raw.toLowerCase().trim();
    if (!term) return false;
    const re = new RegExp(`(^|[^a-zäöüß])${escapeRegExp(term)}([^a-zäöüß]|$)`, "i");
    return re.test(hay);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function describeIngredients(ingredients: Array<{ name?: string; grams?: number }>): string {
  return ingredients
    .filter((ing) => ing.name && Number(ing.grams) > 0)
    .map((ing) => `${formatAmount(Number(ing.grams))}g ${ing.name}`)
    .join(", ");
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
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
  const adjusted: GeneratedMeal[] = meals.map((meal) => ({
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

  // Enforce 850-kcal cap per meal: split oversized meals into N portions as extra snacks.
  const capped: GeneratedMeal[] = [];
  for (const m of adjusted) {
    const k = Number(m.kcal) || 0;
    if (k <= MAX_KCAL_PER_MEAL) {
      capped.push(m);
      continue;
    }
    const parts = Math.ceil(k / MAX_KCAL_PER_MEAL);
    for (let i = 0; i < parts; i++) {
      capped.push({
        ...m,
        slot: i === 0 ? m.slot : "snack",
        name: parts > 1 ? `${m.name} (Portion ${i + 1}/${parts})` : m.name,
        description: m.description,
        kcal: Math.round(k / parts),
        protein_g: Math.round((Number(m.protein_g) || 0) / parts),
        carbs_g: Math.round((Number(m.carbs_g) || 0) / parts),
        fat_g: Math.round((Number(m.fat_g) || 0) / parts),
      });
    }
  }

  return capped;
}


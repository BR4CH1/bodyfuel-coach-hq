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
    (d: {
      user_id: string;
      scheduled_start_date?: string | null;
      title?: string;
      /** "today" = ab heute bis nächster Einkauf, "next_shopping" = ab nächstem Einkauf für einen vollen Zyklus. */
      start_mode?: "today" | "next_shopping";
      /** Optional override: feste Plan-Länge in Tagen (1–21). Überschreibt die Einkaufstag-Logik. */
      plan_days?: number | null;
    }) => d,
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
    const weeklyBudget: number | null =
      p.weekly_budget_eur != null ? Number(p.weekly_budget_eur) : null;
    const budgetHint = p.budget_band === "<50" ? "Günstige Zutaten." :
      p.budget_band === "50_75" ? "Mittleres Budget." :
      p.budget_band === ">100" ? "Großzügiges Budget." : "";

    const equipmentList: string[] = Array.isArray(p.kitchen_equipment) ? p.kitchen_equipment : [];
    const equipmentNotes: string = (p.kitchen_equipment_notes ?? "").toString().trim();
    const equipmentBlock = equipmentList.length || equipmentNotes
      ? `\n🍳 KÜCHENAUSSTATTUNG (HARTE EINSCHRÄNKUNG — nur Rezepte vorschlagen, die mit diesen Geräten zubereitbar sind):\n${
          equipmentList.length ? "Verfügbare Geräte: " + equipmentList.join(", ") : "(keine Liste vom Coach)"
        }${equipmentNotes ? "\nCoach-Notiz: " + equipmentNotes : ""}\nWenn z. B. KEIN HERD verfügbar ist, dürfen Rezepte nicht „in der Pfanne anbraten" o. ä. verlangen — Garmethode an Airfryer/Backofen/Mikrowelle anpassen.\n`
      : "";

    // Plan length & start date abhängig vom Modus.
    // - "today" (Default): Plan ab HEUTE bis zum nächsten Einkaufstag (Lücken-Plan).
    // - "next_shopping": Plan beginnt am nächsten Einkaufstag und deckt einen ganzen Einkaufszyklus ab.
    const startMode: "today" | "next_shopping" = data.start_mode ?? "today";
    const daysToNextShopping = daysUntilNextShopping(p.shopping_days);
    const start = data.scheduled_start_date
      ? new Date(data.scheduled_start_date)
      : (() => {
          const d = new Date();
          if (startMode === "next_shopping") d.setDate(d.getDate() + daysToNextShopping);
          return d;
        })();
    const computedPlanDays = startMode === "next_shopping"
      ? daysUntilNextShopping(p.shopping_days, start)
      : daysToNextShopping;
    const overrideDays = data.plan_days != null
      ? Math.max(1, Math.min(21, Math.round(data.plan_days)))
      : null;
    const planDays = overrideDays ?? computedPlanDays;


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

    const prompt = `Erstelle einen ${planDays}-Tage-Ernährungsplan mit 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack). Der Plan soll genau bis zum nächsten Einkaufstag reichen.

${plateauNote ? "\n" + plateauNote + "\n" : ""}
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
${wishesBlock}${budgetBlock}${equipmentBlock}
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
    if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { days?: GeneratedDay[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Antwort konnte nicht gelesen werden.");
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
    const avgKcal = roundKcal50(sums.kcal / totalDays);
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

    // Only mark wishes as consumed when the AI actually used them in the plan;
    // unused wishes stay pending so they roll into the next plan.
    if (approvedWishIds.length) {
      const haystack = cleaned
        .flatMap((d) => d.meals.map((m) => `${m.name} ${m.description ?? ""}`))
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

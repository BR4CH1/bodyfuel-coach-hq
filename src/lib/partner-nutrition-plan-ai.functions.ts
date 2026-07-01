import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

type MacroTarget = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Slot = "breakfast" | "lunch" | "dinner" | "snack";
type AiIngredient = { name: string; amount?: number; unit?: string; grams?: number; food_id?: string; text_id?: string };
type PersonMeal = {
  slot: Slot;
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients?: AiIngredient[];
};
type ComputedPersonMeal = PersonMeal & {
  _compute_warnings?: string[];
  _data_source?: string;
  _verified_ratio?: number;
};
type CleanedPartnerDay = { name: string; meals: ComputedPersonMeal[]; type: "training" | "rest" };
type GeneratedDay = {
  type_a?: "training" | "rest";
  type_b?: "training" | "rest";
  person_a: PersonMeal[];
  person_b: PersonMeal[];
};

function clonePersonMeal(meal: PersonMeal): PersonMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ing) => ({ ...ing }))
      : undefined,
  };
}

function cloneComputedPersonMeal(meal: ComputedPersonMeal): ComputedPersonMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ing) => ({ ...ing }))
      : undefined,
    _compute_warnings: Array.isArray(meal._compute_warnings) ? [...meal._compute_warnings] : undefined,
  };
}

function expandPartnerGeneratedDays(
  baseDays: GeneratedDay[],
  schedule: Array<{ type_a: "training" | "rest"; type_b: "training" | "rest" }>,
  planDays: number,
): GeneratedDay[] {
  if (!baseDays.length) return [];
  const pools = new Map<string, GeneratedDay[]>();
  for (const day of baseDays) {
    const key = `${day.type_a ?? "training"}:${day.type_b ?? "training"}`;
    pools.set(key, [...(pools.get(key) ?? []), day]);
  }
  const counters = new Map<string, number>();
  return Array.from({ length: planDays }, (_, i): GeneratedDay => {
    const s = schedule[i] ?? schedule[schedule.length - 1];
    const typeA = s?.type_a ?? "training";
    const typeB = s?.type_b ?? "training";
    const key = `${typeA}:${typeB}`;
    const pool = pools.get(key)?.length ? pools.get(key)! : baseDays;
    const cursor = counters.get(key) ?? 0;
    const template = pool[cursor % pool.length] ?? baseDays[i % baseDays.length] ?? baseDays[0];
    counters.set(key, cursor + 1);
    return {
      type_a: typeA,
      type_b: typeB,
      person_a: (template.person_a ?? []).map(clonePersonMeal),
      person_b: (template.person_b ?? []).map(clonePersonMeal),
    };
  });
}

function roundKcal50(v: number): number {
  return Math.max(0, Math.round(v / 50) * 50);
}

function buildIssn(input: MacroTarget): { training: MacroTarget; rest: MacroTarget } {
  const training = {
    kcal: Math.max(50, roundKcal50(input.kcal)),
    protein_g: Math.max(1, Math.round(input.protein_g)),
    carbs_g: Math.max(1, Math.round(input.carbs_g)),
    fat_g: Math.max(1, Math.round(input.fat_g)),
  };
  let rest: MacroTarget = {
    protein_g: training.protein_g,
    carbs_g: Math.max(1, Math.round(training.carbs_g * 0.65)),
    fat_g: Math.max(1, Math.round(training.fat_g * 1.1)),
    kcal: 0,
  };
  rest.kcal = roundKcal50(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9);
  if (rest.kcal >= training.kcal) {
    rest.kcal = Math.max(50, training.kcal - 100);
  }
  return { training, rest };
}

function slotLabel(slot: Slot): string {
  return slot === "breakfast" ? "Frühstück" : slot === "lunch" ? "Mittagessen" : slot === "dinner" ? "Abendessen" : "Snack";
}

async function loadPerson(supabase: any, userId: string) {
  const [
    { data: profile },
    { data: clientProfile },
    { data: latestWeight },
    { data: targets },
    { data: ratings },
    { data: favs },
    { data: skips },
    { data: wishesData },
  ] = await Promise.all([
    supabase.from("smart_nutrition_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level, coaching_goal")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(30),
    supabase
      .from("nutrition_targets")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("meal_ratings")
      .select("stars, meal:nutrition_plan_meals!inner(name)")
      .eq("user_id", userId)
      .limit(30),
    supabase
      .from("meal_favorites")
      .select("meal:nutrition_plan_meals!inner(name)")
      .eq("user_id", userId)
      .limit(20),
    supabase.from("meal_skips").select("meal_name, reason").eq("user_id", userId).limit(20),
    supabase
      .from("meal_wishes")
      .select("id, wish, applies_to, user_id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .is("consumed_at", null),
  ]);

  const p: any = profile ?? {};
  const cp: any = clientProfile ?? {};
  const weightSeries = (latestWeight as any[]) ?? [];
  const currentWeight: number | null = weightSeries[0]?.weight_kg ?? null;
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
      if (Math.abs(diff) <= 0.3) {
        plateauNote = `⚠️ GEWICHTSPLATEAU bei ${cp.display_name ?? "Kunde"}: Gewicht stagniert seit ~${days} Tagen (Δ ${diff > 0 ? "+" : ""}${diff} kg). Passe für diese Person Portionen/Kalorien um −100 bis −200 kcal/Tag (Fettabbau) bzw. +100 bis +200 kcal (Aufbau) an und wähle bewusst sättigendere bzw. energiedichtere Optionen. Tagesziele weiter innerhalb ±5 % halten.`;
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

  let goalDirection: "cut" | "bulk" | "maintain" = "maintain";
  if (currentWeight && goalWeight) {
    const diff = goalWeight - currentWeight;
    if (diff <= -1) goalDirection = "cut";
    else if (diff >= 1) goalDirection = "bulk";
  }

  const t = (targets as any) ?? {};
  let baseKcal: number | undefined = t.kcal;
  let baseProtein: number | undefined = t.protein_g;
  let baseCarbs: number | undefined = t.carbs_g;
  let baseFat: number | undefined = t.fat_g;
  if (!baseKcal && currentWeight && height && ageYears) {
    const bmr =
      gender === "female"
        ? 10 * currentWeight + 6.25 * height - 5 * ageYears - 161
        : 10 * currentWeight + 6.25 * height - 5 * ageYears + 5;
    const f =
      activityLevel === "sedentary"
        ? 1.3
        : activityLevel === "light"
          ? 1.45
          : activityLevel === "very_active"
            ? 1.75
            : activityLevel === "athlete"
              ? 1.9
              : 1.6;
    let tdee = bmr * f;
    if (goalDirection === "cut") tdee -= 400;
    else if (goalDirection === "bulk") tdee += 300;
    baseKcal = Math.round(tdee / 10) * 10;
    const ppk = goalDirection === "cut" ? 2.2 : goalDirection === "bulk" ? 2.0 : 1.8;
    baseProtein = Math.round(currentWeight * ppk);
    baseFat = Math.round((baseKcal * 0.27) / 9);
    baseCarbs = Math.max(80, Math.round((baseKcal - baseProtein * 4 - baseFat * 9) / 4));
  }

  const tg = buildIssn({
    kcal: baseKcal ?? 2200,
    protein_g: baseProtein ?? 150,
    carbs_g: baseCarbs ?? 240,
    fat_g: baseFat ?? 70,
  });

  const allergies = [
    ...(p.allergies ?? []),
    ...((p.extra_allergies ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
  ];
  const nogos = [
    ...(p.nogo_foods ?? []),
    ...((p.extra_nogos ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
  ];
  const favFoods = [
    ...(p.favorite_foods ?? []),
    ...((p.extra_favorites ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
  ];
  const liked = (ratings ?? []).filter((r: any) => r.stars >= 4).map((r: any) => r.meal?.name).filter(Boolean);
  const disliked = (ratings ?? []).filter((r: any) => r.stars <= 2).map((r: any) => r.meal?.name).filter(Boolean);
  const favoriteNames = (favs ?? []).map((f: any) => f.meal?.name).filter(Boolean);
  const skipNames = (skips ?? []).map((s: any) => s.meal_name).filter(Boolean);
  const wishesRaw = ((wishesData as any[]) ?? []).map((w) => ({
    id: w.id as string,
    wish: w.wish as string,
    applies_to: (w.applies_to as "self" | "partner" | "both" | null) ?? "self",
  }));
  const approvedWishes = wishesRaw.map((w) => w.wish).filter(Boolean);
  const approvedWishIds = wishesRaw.map((w) => w.id).filter(Boolean);
  const weeklyBudget: number | null = p.weekly_budget_eur != null ? Number(p.weekly_budget_eur) : null;
  const kitchenEquipment: string[] = Array.isArray(p.kitchen_equipment) ? p.kitchen_equipment : [];
  const kitchenEquipmentNotes: string = (p.kitchen_equipment_notes ?? "").toString().trim();

  return {
    name: cp.display_name ?? "Person",
    profile: p,
    goalDirection,
    targets: tg,
    allergies,
    nogos,
    favFoods,
    liked,
    disliked,
    favoriteNames,
    skipNames,
    approvedWishes,
    approvedWishIds,
    wishesRaw,
    weeklyBudget,
    kitchenEquipment,
    kitchenEquipmentNotes,
    trainingSet: new Set<string>((p.training_weekdays ?? []).map((s: string) => s.toLowerCase())),
    shoppingDays: p.shopping_days as string[] | null,
    plateauNote,
  };
}

function normalizeMealsToTargets(meals: PersonMeal[], target: MacroTarget): PersonMeal[] {
  if (!meals.length) return meals;
  const sums = meals.reduce(
    (a, m) => ({
      kcal: a.kcal + (+m.kcal || 0),
      protein_g: a.protein_g + (+m.protein_g || 0),
      carbs_g: a.carbs_g + (+m.carbs_g || 0),
      fat_g: a.fat_g + (+m.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  const scale = (v: number, f: number, t: number) => Math.max(0, Math.round(v * (t / Math.max(1, f))));
  const out = meals.map((m) => ({
    ...m,
    kcal: scale(+m.kcal || 0, sums.kcal, target.kcal),
    protein_g: scale(+m.protein_g || 0, sums.protein_g, target.protein_g),
    carbs_g: scale(+m.carbs_g || 0, sums.carbs_g, target.carbs_g),
    fat_g: scale(+m.fat_g || 0, sums.fat_g, target.fat_g),
  }));
  const last = out[out.length - 1];
  last.kcal += target.kcal - out.reduce((s, m) => s + m.kcal, 0);
  last.protein_g += target.protein_g - out.reduce((s, m) => s + m.protein_g, 0);
  last.carbs_g += target.carbs_g - out.reduce((s, m) => s + m.carbs_g, 0);
  last.fat_g += target.fat_g - out.reduce((s, m) => s + m.fat_g, 0);
  return out;
}

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const WEEKDAY_LABELS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

export const generatePartnerNutritionPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_a: string;
      user_b: string;
      start_mode?: "today" | "next_shopping";
      shared_slots?: { breakfast?: boolean; lunch?: boolean; dinner?: boolean; snack?: boolean };
      /** Optional fixed plan length (1–31). Overrides the shopping-cycle logic. */
      plan_days?: number | null;
      /** Optional explicit start date (YYYY-MM-DD). Overrides start_mode. */
      scheduled_start_date?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const sharedSlots = {
      breakfast: !!data.shared_slots?.breakfast,
      lunch: !!data.shared_slots?.lunch,
      dinner: data.shared_slots?.dinner ?? true,
      snack: !!data.shared_slots?.snack,
    };

    const [a, b] = await Promise.all([loadPerson(supabase, data.user_a), loadPerson(supabase, data.user_b)]);

    const startMode: "today" | "next_shopping" = data.start_mode ?? "today";
    // Use the EARLIER next-shopping day across both users.
    const daysA = daysUntilNextShopping(a.shoppingDays);
    const daysB = daysUntilNextShopping(b.shoppingDays);
    const start = data.scheduled_start_date ? new Date(data.scheduled_start_date) : new Date();
    if (!data.scheduled_start_date && startMode === "next_shopping") {
      start.setDate(start.getDate() + Math.min(daysA, daysB));
    }
    const fixedDays =
      data.plan_days != null ? Math.max(1, Math.min(31, Math.round(data.plan_days))) : null;
    const planDays =
      fixedDays ??
      (startMode === "next_shopping"
        ? Math.min(daysUntilNextShopping(a.shoppingDays, start), daysUntilNextShopping(b.shoppingDays, start))
        : Math.min(daysA, daysB));

    const dayTypeFor = (user: typeof a, idx: number, date: Date): "training" | "rest" => {
      const k = WEEKDAY_KEYS[date.getDay()];
      if (user.trainingSet.size > 0) return user.trainingSet.has(k) ? "training" : "rest";
      return idx % 7 < 4 ? "training" : "rest";
    };

    const schedule = Array.from({ length: planDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        label: WEEKDAY_LABELS_DE[d.getDay()],
        type_a: dayTypeFor(a, i, d),
        type_b: dayTypeFor(b, i, d),
      };
    });

    const mergedAllergies = Array.from(new Set([...a.allergies, ...b.allergies].map((s) => s.toLowerCase())));
    const mergedNogos = Array.from(new Set([...a.nogos, ...b.nogos].map((s) => s.toLowerCase())));
    const forbidden = Array.from(new Set([...mergedAllergies, ...mergedNogos].map((s) => s.trim()).filter(Boolean)));
    const filterMeals = (ms: PersonMeal[]) =>
      ms.filter((m) => {
        const hay = `${m.name} ${m.description ?? ""} ${JSON.stringify((m as any).ingredients ?? [])}`.toLowerCase();
        return !forbidden.some((f) => hay.includes(f));
      });

    const SHARED = (["breakfast", "lunch", "dinner", "snack"] as const)
      .filter((s) => sharedSlots[s])
      .map(slotLabel)
      .join(", ");
    const SOLO = (["breakfast", "lunch", "dinner", "snack"] as const)
      .filter((s) => !sharedSlots[s])
      .map(slotLabel)
      .join(", ");

    // Lange Partnerpläne werden nicht als ein riesiger KI-Request erzeugt.
    // Die KI liefert max. 7 Basistage, der Server rollt sie auf bis zu 31 Tage aus.
    const aiPlanDays = Math.min(planDays, 7);
    const aiSchedule = schedule.slice(0, aiPlanDays);

    const scheduleLines = aiSchedule
      .map(
        (s, i) =>
          `Tag ${i + 1} (${s.label}): ${a.name}=${s.type_a === "training" ? "TRAINING" : "REST"}, ${b.name}=${s.type_b === "training" ? "TRAINING" : "REST"}`,
      )
      .join("\n");

    const targetBlockFor = (n: string, tg: { training: MacroTarget; rest: MacroTarget }) =>
      `${n} — TRAINING: ${tg.training.kcal} kcal / P ${tg.training.protein_g} / KH ${tg.training.carbs_g} / F ${tg.training.fat_g}; REST: ${tg.rest.kcal} kcal / P ${tg.rest.protein_g} / KH ${tg.rest.carbs_g} / F ${tg.rest.fat_g}`;

    // Wünsche per applies_to neu verteilen:
    // - self  → bleibt bei der Person, die ihn eingereicht hat
    // - partner → wandert komplett zur anderen Person
    // - both  → bei beiden Personen
    const aWishesFinal = [
      ...a.wishesRaw.filter((w) => w.applies_to !== "partner").map((w) => w.wish),
      ...b.wishesRaw.filter((w) => w.applies_to === "partner" || w.applies_to === "both").map((w) => w.wish),
    ];
    const bWishesFinal = [
      ...b.wishesRaw.filter((w) => w.applies_to !== "partner").map((w) => w.wish),
      ...a.wishesRaw.filter((w) => w.applies_to === "partner" || w.applies_to === "both").map((w) => w.wish),
    ];
    const wishesA = aWishesFinal;
    const wishesB = bWishesFinal;
    const wishesBlock =
      wishesA.length || wishesB.length
        ? `\n⭐ COACH-FREIGEGEBENE WUNSCHGERICHTE (PFLICHT — JEDES muss mindestens einmal als Mahlzeit der jeweiligen Person im Plan vorkommen, "name" muss den Wunsch enthalten):
${wishesA.length ? `${a.name}: ${wishesA.map((w, i) => `${i + 1}. ${w}`).join("; ")}` : ""}
${wishesB.length ? `${b.name}: ${wishesB.map((w, i) => `${i + 1}. ${w}`).join("; ")}` : ""}\n`
        : "";

    const equipmentUnion = Array.from(
      new Set([...(a.kitchenEquipment ?? []), ...(b.kitchenEquipment ?? [])]),
    );
    const equipmentNotesCombined = [a.kitchenEquipmentNotes, b.kitchenEquipmentNotes]
      .filter((s) => s && s.length > 0)
      .join(" | ");
    const equipmentLowerP = equipmentUnion.map((e) => e.toLowerCase());
    const notesLowerP = (equipmentNotesCombined || "").toLowerCase();
    const cookingDevicesP = ["herd", "stove", "ofen", "backofen", "oven", "airfryer", "air fryer", "heißluft", "mikrowelle", "microwave", "kochplatte", "induktion", "gas", "grill", "thermomix", "reiskocher", "wasserkocher", "kettle", "dampfgarer", "slow cooker", "instant pot", "multikocher", "pfanne", "topf"];
    const hasCookingDeviceP = equipmentLowerP.some((e) => cookingDevicesP.some((d) => e.includes(d)));
    const notesIndicatesNoCookP = /\b(keine k(ü|ue)che|nur k(ü|ue)hlschrank|alles\s+(muss\s+)?kalt|no[- ]?cook|kein herd|kein ofen|nichts kochen|nicht kochen)\b/.test(notesLowerP);
    const isNoCookP = (equipmentUnion.length > 0 || (equipmentNotesCombined && equipmentNotesCombined.length > 0)) && (!hasCookingDeviceP || notesIndicatesNoCookP);

    const equipmentBlock = equipmentUnion.length || equipmentNotesCombined
      ? `\n🍳 KÜCHENAUSSTATTUNG (HARTE EINSCHRÄNKUNG — beide kochen gemeinsam; nur Rezepte vorschlagen, die mit DIESEN Geräten zubereitbar sind):\n${
          equipmentUnion.length ? "Verfügbare Geräte: " + equipmentUnion.join(", ") : "(keine Liste vom Coach)"
        }${equipmentNotesCombined ? "\nCoach-Notiz: " + equipmentNotesCombined : ""}\nWenn z. B. KEIN HERD verfügbar ist, dürfen Rezepte nicht „in der Pfanne anbraten" verlangen — Garmethode an Airfryer/Backofen/Mikrowelle anpassen.\n`
      : "";

    const noCookBlock = isNoCookP
      ? `\n\n🧊🧊🧊 ABSOLUTE NO-COOK-REGEL (HÖCHSTE PRIORITÄT — überschreibt alle anderen Vorschläge):
Beide Partner haben KEINE Garmethode verfügbar (nur Kühlschrank / alles muss kalt aus dem Supermarkt verzehrbar sein).

❌ STRIKT VERBOTEN — auch nicht mit dem Zusatz "(kalt)" oder "vorgekocht":
- Nudeln, Reis, Kartoffeln, Quinoa, Bulgur, Couscous, Linsen-Trockenware (egal ob "gekocht, kalt" deklariert)
- Rohes Fleisch, rohes Hackfleisch, Hähnchenbrust roh, Fisch roh
- Eier (jeder Art)
- Tiefkühlware, die aufgetaut/gegart werden muss
- Alles, was die Worte „gekocht", „angebraten", „gebacken", „gegrillt", „erhitzt", „aufgewärmt" enthält

✅ NUR ERLAUBT (fertig vom Supermarktregal / aus der Kühltheke):
- Aufschnitt aus der Wurst-/Kühltheke (Schinken, Putenbrust, Bresaola, Salami, Roastbeef-Aufschnitt)
- Räucherlachs, Räucherforelle, Räuchermakrele
- Thunfisch / Sardinen / Makrele aus der Dose
- Skyr, Quark, Naturjoghurt, Hüttenkäse, Frischkäse, Käse-Scheiben
- Fertig gekochte Linsen/Kichererbsen/Bohnen/Mais aus Dose
- Hummus, Tzatziki
- Brot, Wraps, Tortillas, Knäckebrot, Reiswaffeln
- Rohes Obst & Gemüse, Salat-Fertigmischungen
- Overnight Oats (Haferflocken in Milch/Joghurt eingeweicht — NICHT gekocht)
- Proteinpulver, Riegel, Shakes, Beef Jerky, Nüsse

Jede Mahlzeit MUSS aus dieser Erlaubt-Liste komponiert sein. Worte wie "gekocht/gebacken/angebraten" in description sind FALSCH.\n`
      : "";



    const combinedBudget =
      (a.weeklyBudget ?? 0) + (b.weeklyBudget ?? 0) > 0
        ? (a.weeklyBudget ?? 0) + (b.weeklyBudget ?? 0)
        : null;
    const budgetForPeriod =
      combinedBudget != null ? Math.round((combinedBudget * planDays) / 7) : null;
    const budgetBlock =
      budgetForPeriod != null
        ? `\n💶 GEMEINSAMES WOCHEN-BUDGET vom Coach: ${combinedBudget} € / Woche (= ~${budgetForPeriod} € für diesen ${planDays}-Tage-Plan, Discounter-Preise DE). Plane Zutaten & Mengen für BEIDE Personen zusammen so, dass die gesamten Lebensmittelkosten dieses Budget NICHT überschreiten. Bevorzuge günstige Proteinquellen und Grundbeilagen; Premium-Zutaten sparsam.\n`
        : "";

    // Geschlossener Lebensmittel-Katalog: Partner-Pläne dürfen keine freien
    // Zutaten mehr erfinden. Die KI muss text_ids aus nutrition_foods verwenden;
    // der Server berechnet anschließend ausschließlich gegen diesen Safe-Pool.
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
    if (!safePool.length) {
      throw new Error("Kein geprüfter Lebensmittel-Katalog verfügbar — Planerstellung abgebrochen.");
    }
    const safePoolPromptLines = safePool
      .map((f) =>
        f.aliases.length
          ? `- ${f.text_id} | ${f.name} (aka ${f.aliases.slice(0, 3).join(", ")})`
          : `- ${f.text_id} | ${f.name}`,
      )
      .join("\n");
    const foodWhitelistBlock = `\n✅ GESCHLOSSENER LEBENSMITTEL-KATALOG (SAFE FOOD POOL — HART):
Jede Zutat MUSS ein Feld "food_id" haben, dessen Wert exakt einer text_id aus dieser Liste entspricht. Keine anderen Lebensmittel — keine Synonyme außerhalb der Liste, keine Marken, keine Energy Bars/Proteinriegel/Fertiggerichte, wenn sie nicht als text_id in der Liste stehen. Wenn eine Wunsch-Zutat fehlt, wähle die nächstpassende text_id aus dieser Liste.

Format je Zeile: text_id | Kanonischer Name (aka Alias1, Alias2)
${safePoolPromptLines}\n`;

    const prompt = `Erstelle eine ${aiPlanDays}-Tage-Basiswoche für einen ${planDays}-Tage-Partner-Ernährungsplan für ZWEI Personen, die zusammen essen. Der Server wiederholt diese Basiswoche anschließend bis Tag ${planDays}; antworte deshalb NICHT mit ${planDays} Tagen, sondern exakt mit ${aiPlanDays} Basistagen.
${noCookBlock}

🎯 INDIVIDUELLE ZIELE (NIE angleichen):
${targetBlockFor(a.name, a.targets)}
${targetBlockFor(b.name, b.targets)}

🍽️ GEMEINSAME MAHLZEITEN: ${SHARED || "(keine)"}
👤 INDIVIDUELLE MAHLZEITEN: ${SOLO || "(keine)"}

Bei gemeinsamen Mahlzeiten: BEIDE bekommen dasselbe Gericht ("name" identisch), aber unterschiedliche Zutatenmengen und Makros — passend zu ihrem individuellen Tagesziel.
Bei individuellen Mahlzeiten: frei wählbar pro Person.

🚨 HARTE AUSSCHLÜSSE (für BEIDE — gilt immer):
ALLERGIEN: ${mergedAllergies.join(", ") || "(keine)"}
NO-GOS für gemeinsame Gerichte vermeiden: ${mergedNogos.join(", ") || "(keine)"}

VORLIEBEN ${a.name}: Lieblings ${[...a.favFoods, ...a.favoriteNames].slice(0, 8).join(", ") || "—"}; mag ${a.liked.slice(0, 6).join(", ") || "—"}; meiden ${[...a.disliked, ...a.skipNames].slice(0, 6).join(", ") || "—"}
VORLIEBEN ${b.name}: Lieblings ${[...b.favFoods, ...b.favoriteNames].slice(0, 8).join(", ") || "—"}; mag ${b.liked.slice(0, 6).join(", ") || "—"}; meiden ${[...b.disliked, ...b.skipNames].slice(0, 6).join(", ") || "—"}
${wishesBlock}${budgetBlock}${equipmentBlock}
${foodWhitelistBlock}
${a.plateauNote ? a.plateauNote + "\n" : ""}${b.plateauNote ? b.plateauNote + "\n" : ""}BASIS-TAGESPLAN:
${scheduleLines}

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{"days":[{"type_a":"training","type_b":"rest","person_a":[{"slot":"breakfast","name":"...","description":"80g Haferflocken, 200g Skyr natur","ingredients":[{"food_id":"haferflocken","name":"Haferflocken","amount":80,"unit":"g"},{"food_id":"skyr_natur","name":"Skyr natur","amount":200,"unit":"g"}],"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}], "person_b":[...]}]}
Genau ${aiPlanDays} Basistage. Pro Person je 4 Slots (breakfast/lunch/dinner/snack). Bei shared-Slots MUSS "name" zwischen person_a und person_b für denselben Slot am selben Tag identisch sein. "description" = NUR kommagetrennte Zutaten mit konkreten Mengen (g, ml, Stück, EL/TL). Niemals "Portion" oder "nach Geschmack".
🧮 STRUKTURIERTE ZUTATEN SIND PFLICHT — die Berechnung läuft ausschließlich über food_id + Gramm:
- Jede Mahlzeit braucht ein ingredients-Array mit allen Zutaten.
- Jede Zutat MUSS "food_id" enthalten — exakt eine text_id aus dem SAFE FOOD POOL oben. Keine Ausnahme.
- Zusätzlich: "name", "amount", "unit" und bei Stück/Scheibe/EL/TL zusätzlich "grams" als Gesamtgewicht.
- Nährwerte dürfen 0 sein — der Server berechnet sie deterministisch aus der Lebensmittel-DB, KI-Schätzungen werden ignoriert.
- Wenn du eine Zutat verwendest, deren food_id NICHT im Katalog steht, wird der komplette Versuch verworfen und neu generiert.`;

    const {
      computeMealFromIngredients,
      computeMealFromDescription,
      coerceIngredients,
      isUsableEngineResult,
      parseDescriptionToEngineIngredients,
    } = await import("./nutrition-engine.server");

    const personA = (g: any): PersonMeal[] =>
      (g?.person_a ?? g?.personA ?? g?.a ?? g?.meals_a ?? g?.user_a ?? g?.meals ?? []) as PersonMeal[];
    const personB = (g: any): PersonMeal[] =>
      (g?.person_b ?? g?.personB ?? g?.b ?? g?.meals_b ?? g?.user_b ?? []) as PersonMeal[];

    async function buildCleanedDaysFor(
      who: typeof a,
      expandedDays: GeneratedDay[],
      pickType: (i: number) => "training" | "rest",
      pickMeals: (g: GeneratedDay) => PersonMeal[],
    ): Promise<CleanedPartnerDay[]> {
      const cleaned: CleanedPartnerDay[] = [];
      const issues: string[] = [];

      for (let dayIndex = 0; dayIndex < expandedDays.length; dayIndex++) {
        const rawMeals = filterMeals(pickMeals(expandedDays[dayIndex]));
        const slots = new Set(rawMeals.map((m) => m.slot));
        for (const required of ["breakfast", "lunch", "dinner"] as const) {
          if (!slots.has(required)) {
            issues.push(`${who.name}, Tag ${dayIndex + 1}: ${slotLabel(required)} fehlt oder wurde wegen No-Go/Allergie entfernt`);
          }
        }

        const meals: ComputedPersonMeal[] = [];
        for (let mealIdx = 0; mealIdx < rawMeals.length; mealIdx++) {
          const m = rawMeals[mealIdx];
          const structured = coerceIngredients((m as any).ingredients ?? null);
          const ingredientsForMath = structured.length
            ? structured
            : parseDescriptionToEngineIngredients(m.description ?? null);
          const computed = structured.length
            ? await computeMealFromIngredients(supabase, structured, { smartOnly: true, requireResolvedIds: true })
            : await computeMealFromDescription(supabase, m.description ?? null, { smartOnly: true, requireResolvedIds: true });

          if (!isUsableEngineResult(computed)) {
            const unresolved = ((computed as any)?.unresolved_ingredients ?? [])
              .map((u: any) => `${u.name}${u.food_id ? ` (food_id="${u.food_id}")` : ""}`)
              .join(", ");
            const warnings = Array.isArray((computed as any)?.warnings) ? (computed as any).warnings.join(" | ") : "";
            issues.push(
              `${who.name}, Tag ${dayIndex + 1}, Mahlzeit ${mealIdx + 1} (${m.name}): ${unresolved || warnings || "nicht aus Safe-Pool berechenbar"}`,
            );
            continue;
          }

          meals.push({
            ...m,
            ingredients: ingredientsForMath,
            kcal: computed.kcal,
            protein_g: computed.protein_g,
            carbs_g: computed.carbs_g,
            fat_g: computed.fat_g,
            _compute_warnings: computed.warnings,
            _data_source: computed.data_source,
            _verified_ratio: computed.coverage,
          } as ComputedPersonMeal);
        }

        cleaned.push({
          name: `${schedule[dayIndex].label} — ${pickType(dayIndex) === "rest" ? "Restday" : "Trainingstag"}`,
          meals,
          type: pickType(dayIndex),
        });
      }

      if (issues.length) {
        const err = new Error(issues.slice(0, 12).join("; ")) as Error & { issues?: string[] };
        err.issues = issues;
        throw err;
      }
      return cleaned;
    }

    async function prepareGeneratedDays(baseDays: GeneratedDay[]): Promise<{
      days: GeneratedDay[];
      aCleaned: CleanedPartnerDay[];
      bCleaned: CleanedPartnerDay[];
    }> {
      const expandedDays = expandPartnerGeneratedDays(baseDays, schedule, planDays);
      const aCleaned = await buildCleanedDaysFor(a, expandedDays, (i) => schedule[i].type_a, (g) => personA(g));
      const bCleaned = await buildCleanedDaysFor(b, expandedDays, (i) => schedule[i].type_b, (g) => personB(g));
      return { days: expandedDays, aCleaned, bCleaned };
    }

    // Robust: bis zu 3 Versuche. Gemini-2.5-flash liefert im JSON-Modus
    // gelegentlich einen leeren String zurück (Reasoning-Budget verbraucht,
    // aber kein Content). In dem Fall retry und schließlich auf Pro-Modell
    // wechseln, statt den Coach mit „Keine Mahlzeiten geliefert" abzuwürgen.
    const countMeals = (g: any) =>
      ((g?.person_a ?? g?.personA ?? g?.a ?? g?.meals_a ?? g?.user_a ?? g?.meals ?? []).length) +
      ((g?.person_b ?? g?.personB ?? g?.b ?? g?.meals_b ?? g?.user_b ?? []).length);

    let generatedDays: GeneratedDay[] = [];
    let prepared: Awaited<ReturnType<typeof prepareGeneratedDays>> | null = null;
    let lastRawSample = "";
    let correctionNote = "";
    const attempts: Array<{ model: string; extra: string }> = [
      { model: "google/gemini-2.5-flash", extra: "" },
      { model: "google/gemini-2.5-flash", extra: "\n\nWICHTIG: Antworte SOFORT mit dem JSON — keine leere Antwort, kein Fließtext, kein Kommentar. Wenn du unsicher bist, verwende Standard-Zutaten aus der Erlaubt-Liste." },
      { model: "google/gemini-2.5-pro", extra: "\n\nWICHTIG: Antworte SOFORT mit dem vollständigen JSON gemäß Schema. Keine leere Antwort." },
    ];

    for (let att = 0; att < attempts.length; att++) {
      const { model, extra } = attempts[att];
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt + extra + correctionNote }],
        }),
      });
      if (aiRes.status === 429) throw new Error("Rate-Limit erreicht.");
      if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht.");
      if (!aiRes.ok) {
        if (att === attempts.length - 1) throw new Error(`Fehler [${aiRes.status}]`);
        continue;
      }
      const raw = (await aiRes.json())?.choices?.[0]?.message?.content ?? "{}";
      lastRawSample = typeof raw === "string" ? raw.slice(0, 300) : JSON.stringify(raw).slice(0, 300);
      let parsed: { days?: GeneratedDay[] } = {};
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        console.warn(`[partner-plan] attempt ${att + 1}/${attempts.length}: JSON parse failed. sample=`, lastRawSample);
        continue;
      }
      const candidate = (parsed.days ?? [])
        .slice(0, aiPlanDays)
        .map((d: GeneratedDay, i: number): GeneratedDay => ({
          ...d,
          type_a: aiSchedule[i]?.type_a ?? d.type_a,
          type_b: aiSchedule[i]?.type_b ?? d.type_b,
        }));
      const totalMeals = candidate.reduce((s: number, g: any) => s + countMeals(g), 0);
      if (candidate.length && totalMeals > 0) {
        try {
          prepared = await prepareGeneratedDays(candidate);
          generatedDays = candidate;
          break;
        } catch (e: any) {
          const issues = Array.isArray(e?.issues) ? e.issues : [e?.message ?? "unbekannter Fehler"];
          console.warn(
            `[partner-plan] attempt ${att + 1}/${attempts.length} failed safe-pool validation (model=${model}).`,
            issues.slice(0, 8),
          );
          const uniqueBad = Array.from(new Set(issues.map((x: string) => String(x)))).slice(0, 20);
          correctionNote = `\n\n⚠️ RETRY-KORREKTUR: Der vorherige Versuch enthielt Zutaten/Mahlzeiten, die NICHT eindeutig aus dem SAFE FOOD POOL berechenbar waren oder wegen No-Go/Allergie entfernt wurden:\n- ${uniqueBad.join("\n- ")}\n\nGeneriere den Plan komplett neu. Verwende AUSSCHLIESSLICH food_id-Werte aus dem SAFE FOOD POOL. Ersetze Energy Bar/Proteinriegel/Fertigprodukte durch konkrete Katalog-Zutaten, sofern kein passender food_id existiert.`;
          continue;
        }
      }
      console.warn(
        `[partner-plan] attempt ${att + 1}/${attempts.length} unusable (days=${candidate.length}, meals=${totalMeals}, model=${model}). sample=`,
        lastRawSample,
      );
    }

    if (!generatedDays.length || !prepared) {
      throw new Error(
        "Der Partner-Plan konnte nicht sauber aus vorhandenen Datenbank-Lebensmitteln erstellt werden. Bitte erneut versuchen oder den Lebensmittel-Katalog erweitern.",
      );
    }

    // Archive existing pending plans for both users.
    await supabase
      .from("nutrition_plans")
      .update({ status: "archived" })
      .in("client_id", [data.user_a, data.user_b])
      .eq("plan_type", "nutrition")
      .in("status", ["draft", "approved", "published"]);

    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setDate(end.getDate() + planDays - 1);

    async function insertPlanFor(
      who: typeof a,
      clientId: string,
      cleanedDays: CleanedPartnerDay[],
    ): Promise<{ planId: string; dayIds: string[]; mealsByDay: ComputedPersonMeal[][] }> {
      const sums = cleanedDays.reduce(
        (acc, d) => {
          for (const m of d.meals) {
            acc.kcal += m.kcal;
            acc.p += m.protein_g;
            acc.c += m.carbs_g;
            acc.f += m.fat_g;
          }
          return acc;
        },
        { kcal: 0, p: 0, c: 0, f: 0 },
      );
      const td = Math.max(1, cleanedDays.length);
      const { data: planRow, error } = await supabase
        .from("nutrition_plans")
        .insert({
          client_id: clientId,
          title: `Partner-Plan mit ${clientId === data.user_a ? b.name : a.name} — ${new Date().toLocaleDateString("de-DE")}`,
          plan_type: "nutrition",
          is_active: false,
          status: "draft",
          generated_by: "ai_auto",
          source: "smart_ai",
          uploaded_by: userId,
          file_path: `ai-generated/${clientId}/partner-${Date.now()}.json`,
          file_name: "ai-partner.json",
          scheduled_start_date: isoDate(start),
          scheduled_end_date: isoDate(end),
          kcal: roundKcal50(sums.kcal / td),
          protein_g: Math.round(sums.p / td),
          carbs_g: Math.round(sums.c / td),
          fat_g: Math.round(sums.f / td),
          is_partner_plan: true,
        })
        .select("id")
        .single();
      if (error || !planRow) throw new Error(error?.message ?? "Plan-Insert fehlgeschlagen");

      const dayIds: string[] = [];
      const mealsByDay: ComputedPersonMeal[][] = [];
      for (let i = 0; i < cleanedDays.length; i++) {
        const d = cleanedDays[i];
        const { data: dayRow } = await supabase
          .from("nutrition_plan_days")
          .insert({ plan_id: planRow.id, name: d.name, sort_order: i })
          .select("id")
          .single();
        if (!dayRow?.id) throw new Error("Day-Insert fehlgeschlagen");
        dayIds.push(dayRow.id as string);
        mealsByDay.push(d.meals);
      }
      return { planId: planRow.id, dayIds, mealsByDay };
    }

    const A = await insertPlanFor(a, data.user_a, prepared.aCleaned);
    const B = await insertPlanFor(b, data.user_b, prepared.bCleaned);

    // Insert meals; capture IDs to link shared pairs.
    const insertMealsFor = async (
      who: "a" | "b",
      bundle: typeof A,
      otherName: string,
    ): Promise<{ ids: string[][] }> => {
      const ids: string[][] = [];
      for (let i = 0; i < bundle.dayIds.length; i++) {
        const dayId = bundle.dayIds[i];
        const meals = bundle.mealsByDay[i];
        const rows: string[] = [];
        for (let idx = 0; idx < meals.length; idx++) {
          const m = meals[idx];
          const isShared = sharedSlots[m.slot] === true;
          const prefix = isShared ? `🍽️ Gemeinsam mit ${otherName} — ${slotLabel(m.slot)}` : slotLabel(m.slot);
          const { data: mealRow, error: mealErr } = await supabase
            .from("nutrition_plan_meals")
            .insert({
              day_id: dayId,
              name: `${prefix}: ${m.name}`,
              description: m.description ?? null,
              ingredients_json: coerceIngredients((m as any).ingredients ?? null).length ? coerceIngredients((m as any).ingredients ?? null) : null,
              compute_warnings: (m as any)._compute_warnings ?? [],
              kcal: m.kcal,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              sort_order: idx,
              is_shared: isShared,
              data_source: (m as any)._data_source ?? "db_verified",
              verified_ratio: (m as any)._verified_ratio ?? 1,
            })
            .select("id")
            .single();
          if (mealErr || !mealRow?.id) {
            console.error("[partner-plan] meal insert failed", { who, dayId, mealErr, meal: m });
            throw new Error(`Mahlzeit konnte nicht gespeichert werden: ${mealErr?.message ?? "unbekannt"}`);
          }
          rows.push(mealRow.id);
        }
        ids.push(rows);
      }
      return { ids };
    };

    const mA = await insertMealsFor("a", A, b.name);
    const mB = await insertMealsFor("b", B, a.name);

    // Link plans to each other.
    await supabase.from("nutrition_plans").update({ partner_plan_id: B.planId }).eq("id", A.planId);
    await supabase.from("nutrition_plans").update({ partner_plan_id: A.planId }).eq("id", B.planId);

    // Cross-link shared meals.
    for (let d = 0; d < Math.min(mA.ids.length, mB.ids.length); d++) {
      const aMeals = A.mealsByDay[d];
      const bMeals = B.mealsByDay[d];
      for (let i = 0; i < Math.min(aMeals.length, bMeals.length); i++) {
        const slot = aMeals[i].slot;
        if (sharedSlots[slot]) {
          const aId = mA.ids[d][i];
          const bId = mB.ids[d][i];
          if (aId && bId) {
            await supabase.from("nutrition_plan_meals").update({ partner_meal_id: bId }).eq("id", aId);
            await supabase.from("nutrition_plan_meals").update({ partner_meal_id: aId }).eq("id", bId);
          }
        }
      }
    }

    // Build shopping lists (individual for each + combined). The engine uses
    // the admin client internally, so partner-plan writes succeed even when
    // the caller is not the partner's plan owner.
    let shoppingListWarning: string | null = null;
    try {
      const { generateShoppingListForPlan, generateCombinedShoppingList } = await import(
        "./shopping-list-engine.server"
      );
      await generateShoppingListForPlan({ apiKey, planId: A.planId, windowDays: planDays });
      await generateShoppingListForPlan({ apiKey, planId: B.planId, windowDays: planDays });
      await generateCombinedShoppingList({
        apiKey,
        planAId: A.planId,
        planBId: B.planId,
        userA: data.user_a,
        userB: data.user_b,
        windowDays: planDays,
      });
    } catch (e: any) {
      console.error("Partner shopping list failed:", e);
      shoppingListWarning = e?.message ?? "Einkaufsliste konnte nicht erstellt werden.";
    }

    // Mark each user's approved wishes as consumed only if the AI actually used them.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").trim();
    const consumeUsedWishes = async (person: typeof a, bundle: typeof A) => {
      if (!person.approvedWishIds?.length) return;
      const haystack = bundle.mealsByDay
        .flat()
        .map((m) => `${m.name} ${m.description ?? ""}`)
        .join(" | ")
        .toLowerCase();
      const used: string[] = [];
      person.approvedWishes.forEach((w, idx) => {
        const key = norm(w);
        if (key && haystack.includes(key)) used.push(person.approvedWishIds[idx]);
      });
      if (used.length) {
        await supabase
          .from("meal_wishes")
          .update({ consumed_at: new Date().toISOString() })
          .in("id", used);
      }
    };
    await consumeUsedWishes(a, A);
    await consumeUsedWishes(b, B);

    return { ok: true, plan_a: A.planId, plan_b: B.planId, days: planDays, shopping_list_warning: shoppingListWarning };
  });

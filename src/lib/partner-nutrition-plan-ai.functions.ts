import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

type MacroTarget = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Slot = "breakfast" | "lunch" | "dinner" | "snack";
type PersonMeal = {
  slot: Slot;
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
type GeneratedDay = {
  type_a?: "training" | "rest";
  type_b?: "training" | "rest";
  person_a: PersonMeal[];
  person_b: PersonMeal[];
};

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
  ] = await Promise.all([
    supabase.from("smart_nutrition_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level, coaching_goal")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  ]);

  const p: any = profile ?? {};
  const cp: any = clientProfile ?? {};
  const currentWeight: number | null = (latestWeight as any)?.weight_kg ?? null;
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
    trainingSet: new Set<string>((p.training_weekdays ?? []).map((s: string) => s.toLowerCase())),
    shoppingDays: p.shopping_days as string[] | null,
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
    const start = new Date();
    if (startMode === "next_shopping") start.setDate(start.getDate() + Math.min(daysA, daysB));
    const planDays = startMode === "next_shopping"
      ? Math.min(daysUntilNextShopping(a.shoppingDays, start), daysUntilNextShopping(b.shoppingDays, start))
      : Math.min(daysA, daysB);

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

    const SHARED = (["breakfast", "lunch", "dinner", "snack"] as const)
      .filter((s) => sharedSlots[s])
      .map(slotLabel)
      .join(", ");
    const SOLO = (["breakfast", "lunch", "dinner", "snack"] as const)
      .filter((s) => !sharedSlots[s])
      .map(slotLabel)
      .join(", ");

    const scheduleLines = schedule
      .map(
        (s, i) =>
          `Tag ${i + 1} (${s.label}): ${a.name}=${s.type_a === "training" ? "TRAINING" : "REST"}, ${b.name}=${s.type_b === "training" ? "TRAINING" : "REST"}`,
      )
      .join("\n");

    const targetBlockFor = (n: string, tg: { training: MacroTarget; rest: MacroTarget }) =>
      `${n} — TRAINING: ${tg.training.kcal} kcal / P ${tg.training.protein_g} / KH ${tg.training.carbs_g} / F ${tg.training.fat_g}; REST: ${tg.rest.kcal} kcal / P ${tg.rest.protein_g} / KH ${tg.rest.carbs_g} / F ${tg.rest.fat_g}`;

    const prompt = `Erstelle einen ${planDays}-Tage-Partner-Ernährungsplan für ZWEI Personen, die zusammen essen.

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

TAGESPLAN:
${scheduleLines}

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{"days":[{"type_a":"training","type_b":"rest","person_a":[{"slot":"breakfast","name":"...","description":"80g X, 200ml Y","kcal":500,"protein_g":35,"carbs_g":55,"fat_g":15}], "person_b":[...]}]}
Genau ${planDays} Tage. Pro Person je 4 Slots (breakfast/lunch/dinner/snack). Bei shared-Slots MUSS "name" zwischen person_a und person_b für denselben Slot am selben Tag identisch sein. "description" = NUR kommagetrennte Zutaten mit konkreten Mengen (g, ml, Stück, EL/TL). Niemals "Portion" oder "nach Geschmack".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (aiRes.status === 429) throw new Error("Rate-Limit erreicht.");
    if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
    if (!aiRes.ok) throw new Error(`KI-Fehler [${aiRes.status}]`);
    const raw = (await aiRes.json())?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { days?: GeneratedDay[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden.");
    }
    const days = (parsed.days ?? []).slice(0, planDays);
    if (!days.length) throw new Error("Keine Tage generiert.");

    const forbidden = mergedAllergies; // never tolerate, for anybody
    const filterMeals = (ms: PersonMeal[]) =>
      ms.filter((m) => {
        const hay = `${m.name} ${m.description ?? ""}`.toLowerCase();
        return !forbidden.some((f) => hay.includes(f));
      });

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
      pickType: (i: number) => "training" | "rest",
      pickMeals: (g: GeneratedDay) => PersonMeal[],
    ): Promise<{ planId: string; dayIds: string[]; mealsByDay: PersonMeal[][] }> {
      const cleanedDays: { name: string; meals: PersonMeal[]; type: "training" | "rest" }[] = [];
      for (let i = 0; i < days.length; i++) {
        const g = days[i];
        const type = pickType(i);
        const tg = type === "rest" ? who.targets.rest : who.targets.training;
        const ms = normalizeMealsToTargets(filterMeals(pickMeals(g)), tg);
        cleanedDays.push({
          name: `${schedule[i].label} — ${type === "rest" ? "Restday" : "Trainingstag"}`,
          meals: ms,
          type,
        });
      }
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
          file_path: `ai-generated/partner/${clientId}/${Date.now()}.json`,
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
      const mealsByDay: PersonMeal[][] = [];
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

    const A = await insertPlanFor(a, data.user_a, (i) => schedule[i].type_a, (g) => g.person_a ?? []);
    const B = await insertPlanFor(b, data.user_b, (i) => schedule[i].type_b, (g) => g.person_b ?? []);

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
          const { data: mealRow } = await supabase
            .from("nutrition_plan_meals")
            .insert({
              day_id: dayId,
              name: `${prefix}: ${m.name}`,
              description: m.description ?? null,
              kcal: m.kcal,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              sort_order: idx,
              is_shared: isShared,
            })
            .select("id")
            .single();
          rows.push(mealRow?.id ?? "");
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

    return { ok: true, plan_a: A.planId, plan_b: B.planId, days: planDays };
  });

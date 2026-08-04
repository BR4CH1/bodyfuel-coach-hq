import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { IngredientRole, Per100 } from "@/lib/ingredient-roles";
import {
  assertCoachOrOrgStaffForAthlete,
  assertGlobalCoachOrAnyOrgCoach,
} from "@/lib/organizations/org-coach-access";

// 0=Sun..6=Sat, matches JS Date.getUTCDay()
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  so: 0,
  sonntag: 0,
  "0": 0,
  "7": 0,
  monday: 1,
  mon: 1,
  mo: 1,
  montag: 1,
  "1": 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  di: 2,
  dienstag: 2,
  "2": 2,
  wednesday: 3,
  wed: 3,
  mi: 3,
  mittwoch: 3,
  "3": 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  do: 4,
  donnerstag: 4,
  "4": 4,
  friday: 5,
  fri: 5,
  fr: 5,
  freitag: 5,
  "5": 5,
  saturday: 6,
  sat: 6,
  sa: 6,
  samstag: 6,
  sonnabend: 6,
  "6": 6,
};
function normalizeWeekdays(v: any): number[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const raw of v) {
    if (raw == null) continue;
    const key = String(raw).trim().toLowerCase();
    if (key in WEEKDAY_MAP) out.add(WEEKDAY_MAP[key]);
  }
  return Array.from(out);
}

export type LibraryMeal = {
  id: string;
  name: string;
  description: string | null;
  category: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "post_workout";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_label: string | null;
  ingredients: Array<{ name: string; amount_g?: number }>;
  instructions: string | null;
  tags: string[];
  no_go_ingredients: string[];
  suitable_training: boolean;
  suitable_rest: boolean;
  mealprep_ok: boolean;
  eat_cold: boolean;
  effort: "low" | "medium" | "high";
  budget: "low" | "medium" | "high";
  main_protein: string | null;
  main_carb: string | null;
  image_url?: string | null;
  image_path?: string | null;
  image_status?: "none" | "pending" | "generating" | "ready" | "fallback" | "failed";
  image_source?: string | null;
  image_generated_at?: string | null;
};

export type CustomerPlanContext = {
  targets: {
    kcal_train: number;
    protein_train: number;
    carbs_train: number;
    fat_train: number;
    kcal_rest: number;
    protein_rest: number;
    carbs_rest: number;
    fat_rest: number;
  };
  favoriteFoods: string[];
  noGoFoods: string[];
  allergies: string[];
  intolerances: string[];
  dietStyle: string | null;
  budgetBand: string | null;
  mealPrepStyle: string | null;
  eatingStyle: string | null;
  mealPrepDays: number | null;
  varietyLevel: "low" | "medium" | "high" | null;
  trainingWeekdays: number[]; // 0=Sun..6=Sat
};

export const listMealLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LibraryMeal[]> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("coach_meal_library")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((row) => {
      const meal = row as unknown as LibraryMeal;
      const rawUrl = meal.image_url?.trim() ?? "";
      const storagePath =
        meal.image_path?.trim() || (rawUrl && !/^https?:\/\//i.test(rawUrl) ? rawUrl : "");
      const imageUrl = /^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : storagePath
          ? supabaseAdmin.storage.from("meal-images").getPublicUrl(storagePath).data.publicUrl
          : null;
      return { ...meal, image_url: imageUrl };
    });
  });

export const getCustomerPlanContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customerId: string }) => d)
  .handler(async ({ data, context }): Promise<CustomerPlanContext> => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "nutrition");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: prof }, { data: tgt }] = await Promise.all([
      supabaseAdmin
        .from("smart_nutrition_profile")
        .select("*")
        .eq("user_id", data.customerId)
        .maybeSingle(),
      supabaseAdmin
        .from("nutrition_targets")
        .select("*")
        .eq("user_id", data.customerId)
        .maybeSingle(),
    ]);

    const toList = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      return String(v)
        .split(/[,\n;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    };
    const merge = (...vs: any[]) => Array.from(new Set(vs.flatMap(toList)));

    return {
      targets: {
        kcal_train: Number(tgt?.kcal ?? 0),
        protein_train: Number(tgt?.protein_g ?? 0),
        carbs_train: Number(tgt?.carbs_g ?? 0),
        fat_train: Number(tgt?.fat_g ?? 0),
        kcal_rest: Number(tgt?.kcal_rest ?? tgt?.kcal ?? 0),
        protein_rest: Number(tgt?.protein_g_rest ?? tgt?.protein_g ?? 0),
        carbs_rest: Number(tgt?.carbs_g_rest ?? tgt?.carbs_g ?? 0),
        fat_rest: Number(tgt?.fat_g_rest ?? tgt?.fat_g ?? 0),
      },
      favoriteFoods: merge(prof?.favorite_foods, prof?.extra_favorites),
      noGoFoods: merge(prof?.nogo_foods, prof?.extra_nogos),
      allergies: merge(prof?.allergies, prof?.extra_allergies),
      intolerances: merge(prof?.intolerances),
      dietStyle: prof?.diet_style ?? null,
      budgetBand: prof?.budget_band ?? null,
      mealPrepStyle: prof?.meal_prep_style ?? null,
      eatingStyle: prof?.eating_style ?? null,
      mealPrepDays:
        prof?.meal_prep_days == null || !Number.isFinite(Number(prof.meal_prep_days))
          ? null
          : Math.max(1, Math.min(7, Math.round(Number(prof.meal_prep_days)))),
      varietyLevel:
        prof?.variety_level === "low" ||
        prof?.variety_level === "medium" ||
        prof?.variety_level === "high"
          ? prof.variety_level
          : null,
      trainingWeekdays: normalizeWeekdays(prof?.training_weekdays),
    };
  });

// Save a builder plan by adapting to existing importer.
/**
 * Zutat im Builder. `name`/`grams` sind Pflicht (rückwärtskompatibel).
 * `base_grams`, `role` und `per100` werden nur vom Makro-Ziel-Editor gesetzt
 * und dürfen bei alten Entwürfen fehlen.
 */
export type BuilderIngredient = {
  name: string;
  grams: number;
  /** Ursprungsmenge vor der Makro-Optimierung. */
  base_grams?: number | null;
  role?: IngredientRole | null;
  per100?: Per100 | null;
};
export type BuilderMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description?: string | null;
  ingredients: BuilderIngredient[];
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  library_meal_id?: string | null;
  is_locked?: boolean;
  portion_factor?: number; // 1.0 = normale Portion
  linked_prep_group?: string | null;
  linked_partner_group?: string | null; // shared id when meal is coupled with partner's meal
  /**
   * Makros für Portion 1 nach individueller Zutatenanpassung.
   * Hat Vorrang vor den Bibliothekswerten, sonst würden angepasste
   * Zutatenmengen im Builder nicht sichtbar.
   */
  macro_override?: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
};
export type BuilderDay = {
  name: string;
  type: "training" | "rest";
  typeOverride?: boolean; // true when coach toggled manually
  meals: BuilderMeal[];
  prepCoupleLunchDinner?: boolean;
  /** Individuelles Tagesziel; überschreibt das Profilziel nur in diesem Plan. */
  customTargets?: { kcal: number; p: number; c: number; f: number } | null;
};


async function persistBuilderPlan(
  supabase: any,
  data: {
    customerId: string;
    title: string;
    startDate: string;
    days: BuilderDay[];
    publish?: boolean;
  },
): Promise<{ plan_id: string }> {
  const { saveCoachNutritionPlanDraft } = await import("./coach-plan-import.functions");
  const result = await saveCoachNutritionPlanDraft({
    data: {
      client_id: data.customerId,
      title: data.title,
      start_date: data.startDate,
      mode: "new_plan",
      force: true,
      plan: {
        title: data.title,
        days: data.days.map((d) => ({
          name: d.name,
          type: d.type,
          meals: d.meals.map((m) => {
            const f = m.portion_factor && m.portion_factor > 0 ? m.portion_factor : 1;
            return {
              slot: m.slot,
              name: m.name,
              description: m.description ?? null,
              ingredients: m.ingredients.map((i) => ({
                name: i.name,
                grams: Math.round((i.grams ?? 0) * f),
              })),
            };
          }),
        })),
      },
    },
  } as any);

  const planId = (result as any)?.plan_id as string | undefined;
  if (!planId) throw new Error("Speichern fehlgeschlagen");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const libraryIds = Array.from(
    new Set(
      data.days.flatMap((day) =>
        day.meals.map((meal) => meal.library_meal_id).filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const libraryImages = new Map<
    string,
    {
      image_url: string | null;
      image_path: string | null;
      image_status: string;
      image_source: string | null;
      image_generated_at: string | null;
    }
  >();
  if (libraryIds.length) {
    const { data: imageRows } = await supabaseAdmin
      .from("coach_meal_library")
      .select("id, image_url, image_path, image_status, image_source, image_generated_at")
      .in("id", libraryIds);
    for (const row of imageRows ?? []) libraryImages.set(row.id, row);
  }

  const { data: dayRows } = await supabaseAdmin
    .from("nutrition_plan_days")
    .select("id, sort_order")
    .eq("plan_id", planId)
    .order("sort_order");
  const dayArr = dayRows ?? [];
  for (let di = 0; di < data.days.length && di < dayArr.length; di++) {
    const dayId = dayArr[di].id;
    const src = data.days[di];
    const base = new Date(data.startDate + "T00:00:00Z");
    base.setUTCDate(base.getUTCDate() + di);
    const iso = base.toISOString().slice(0, 10);
    await supabaseAdmin
      .from("nutrition_plan_days")
      .update({
        day_type: src.type,
        day_date: iso,
        target_kcal: src.customTargets ? Math.round(src.customTargets.kcal) : null,
        target_protein_g: src.customTargets ? Math.round(src.customTargets.p) : null,
        target_carbs_g: src.customTargets ? Math.round(src.customTargets.c) : null,
        target_fat_g: src.customTargets ? Math.round(src.customTargets.f) : null,
      } as any)
      .eq("id", dayId);

    const { data: mealRows } = await supabaseAdmin
      .from("nutrition_plan_meals")
      .select("id, sort_order")
      .eq("day_id", dayId)
      .order("sort_order");
    const mealArr = mealRows ?? [];
    for (let mi = 0; mi < src.meals.length && mi < mealArr.length; mi++) {
      const m = src.meals[mi];
      const libraryImage = m.library_meal_id ? libraryImages.get(m.library_meal_id) : undefined;
      await supabaseAdmin
        .from("nutrition_plan_meals")
        .update({
          meal_slot: m.slot,
          library_meal_id: m.library_meal_id ?? null,
          is_locked: !!m.is_locked,
          linked_prep_group: m.linked_prep_group ?? null,
          ...(libraryImage?.image_url
            ? {
                image_url: libraryImage.image_url,
                image_path: libraryImage.image_path,
                image_status: libraryImage.image_status,
                image_source: libraryImage.image_source,
                image_generated_at: libraryImage.image_generated_at,
              }
            : {}),
        } as any)
        .eq("id", mealArr[mi].id);
    }
  }
  if (data.publish) {
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ status: "active" } as any)
      .eq("id", planId);
  }
  return { plan_id: planId };
}

export const saveBuilderPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerId: string;
      title: string;
      startDate: string;
      days: BuilderDay[];
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "nutrition");
    return await persistBuilderPlan(context.supabase, data);
  });

/**
 * Speichert einen Partnerplan: zwei einzelne Pläne + Kreuz-Verknüpfung.
 * partner_plan_id (Plan) und partner_meal_id (Mahlzeit) werden gesetzt,
 * damit AI- und manuelle Partnerpläne dieselbe Datenstruktur nutzen.
 */
export const saveBuilderPartnerPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerId: string;
      partnerId: string;
      title: string;
      startDate: string;
      clientDays: BuilderDay[];
      partnerDays: BuilderDay[];
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "nutrition");
    await assertCoachOrOrgStaffForAthlete(context, data.partnerId, "nutrition");
    if (data.clientDays.length !== data.partnerDays.length) {
      throw new Error("Kunde- und Partner-Tage müssen gleich lang sein.");
    }
    const A = await persistBuilderPlan(context.supabase, {
      customerId: data.customerId,
      title: data.title,
      startDate: data.startDate,
      days: data.clientDays,
      publish: data.publish,
    });
    const B = await persistBuilderPlan(context.supabase, {
      customerId: data.partnerId,
      title: data.title,
      startDate: data.startDate,
      days: data.partnerDays,
      publish: data.publish,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ is_partner_plan: true, partner_plan_id: B.plan_id } as any)
      .eq("id", A.plan_id);
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ is_partner_plan: true, partner_plan_id: A.plan_id } as any)
      .eq("id", B.plan_id);

    // Cross-link partner_meal_id where linked_partner_group matches.
    const [{ data: daysA }, { data: daysB }] = await Promise.all([
      supabaseAdmin
        .from("nutrition_plan_days")
        .select("id, sort_order")
        .eq("plan_id", A.plan_id)
        .order("sort_order"),
      supabaseAdmin
        .from("nutrition_plan_days")
        .select("id, sort_order")
        .eq("plan_id", B.plan_id)
        .order("sort_order"),
    ]);
    const dA = daysA ?? [];
    const dB = daysB ?? [];
    for (let i = 0; i < Math.min(dA.length, dB.length); i++) {
      const [{ data: mealsA }, { data: mealsB }] = await Promise.all([
        supabaseAdmin
          .from("nutrition_plan_meals")
          .select("id, sort_order, meal_slot")
          .eq("day_id", dA[i].id)
          .order("sort_order"),
        supabaseAdmin
          .from("nutrition_plan_meals")
          .select("id, sort_order, meal_slot")
          .eq("day_id", dB[i].id)
          .order("sort_order"),
      ]);
      const mA = mealsA ?? [];
      const mB = mealsB ?? [];
      const srcA = data.clientDays[i]?.meals ?? [];
      const srcB = data.partnerDays[i]?.meals ?? [];
      // Iterate srcA in same order the persist step wrote them.
      for (let ai = 0; ai < srcA.length && ai < mA.length; ai++) {
        const grp = srcA[ai].linked_partner_group;
        if (!grp) continue;
        const bIdxSrc = srcB.findIndex((m) => m.linked_partner_group === grp);
        if (bIdxSrc < 0 || bIdxSrc >= mB.length) continue;
        const aId = mA[ai].id;
        const bId = mB[bIdxSrc].id;
        await supabaseAdmin
          .from("nutrition_plan_meals")
          .update({ partner_meal_id: bId } as any)
          .eq("id", aId);
        await supabaseAdmin
          .from("nutrition_plan_meals")
          .update({ partner_meal_id: aId } as any)
          .eq("id", bId);
      }
    }

    // Ensure a nutrition_partners link exists (both directions checked) so
    // shopping list & partner-mode UIs light up like the AI-generated flow.
    const { data: existingLink } = await supabaseAdmin
      .from("nutrition_partners")
      .select("id")
      .or(
        `and(user_a.eq.${data.customerId},user_b.eq.${data.partnerId}),and(user_a.eq.${data.partnerId},user_b.eq.${data.customerId})`,
      )
      .maybeSingle();
    if (!existingLink) {
      await supabaseAdmin.from("nutrition_partners").insert({
        user_a: data.customerId,
        user_b: data.partnerId,
        created_by: context.userId,
      } as any);
    }

    // Build individual + combined shopping lists (best-effort, like AI flow).
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const { daysUntilNextShopping } = await import("./shopping-cycle");
        const { data: prof } = await supabaseAdmin
          .from("smart_nutrition_profile")
          .select("shopping_days")
          .eq("user_id", data.customerId)
          .maybeSingle();
        const windowDays = daysUntilNextShopping((prof as any)?.shopping_days);
        const { generateShoppingListForPlan, generateCombinedShoppingList } =
          await import("./shopping-list-engine.server");
        await generateShoppingListForPlan({
          supabase: supabaseAdmin,
          apiKey,
          planId: A.plan_id,
          windowDays,
        });
        await generateShoppingListForPlan({
          supabase: supabaseAdmin,
          apiKey,
          planId: B.plan_id,
          windowDays,
        });
        await generateCombinedShoppingList({
          apiKey,
          planAId: A.plan_id,
          planBId: B.plan_id,
          userA: data.customerId,
          userB: data.partnerId,
          windowDays,
        });
      } catch (e) {
        console.error("Partner shopping list (manual plan) failed:", e);
      }
    }

    return { ok: true, client_plan_id: A.plan_id, partner_plan_id: B.plan_id };
  });


// -------- Load existing plan for editing --------

export type LoadedBuilderPlan = {
  plan_id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: BuilderDay[];
};

export const loadNutritionPlanForBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<LoadedBuilderPlan> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error: pErr } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, title, scheduled_start_date, scheduled_end_date, plan_type")
      .eq("id", data.planId)
      .maybeSingle();
    if (pErr || !plan) throw new Error(pErr?.message ?? "Plan nicht gefunden");
    if ((plan as any).plan_type === "training") throw new Error("Kein Ernährungsplan");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "nutrition");

    const { data: dayRows } = await supabaseAdmin
      .from("nutrition_plan_days")
      .select("id, sort_order, day_type, day_date")
      .eq("plan_id", data.planId)
      .order("sort_order");

    const dayIds = ((dayRows ?? []) as any[]).map((r) => r.id);
    const mealRes = dayIds.length
      ? await supabaseAdmin
          .from("nutrition_plan_meals")
          .select(
            "id, day_id, sort_order, meal_slot, name, description, library_meal_id, is_locked, linked_prep_group, ingredients_json, kcal, protein_g, carbs_g, fat_g",
          )
          .in("day_id", dayIds)
          .order("sort_order")
      : ({ data: [] as any[] } as any);

    const byDay = new Map<string, any[]>();
    for (const m of (mealRes.data ?? []) as any[]) {
      const arr = byDay.get(m.day_id) ?? [];
      arr.push(m);
      byDay.set(m.day_id, arr);
    }

    const start = (plan as any).scheduled_start_date ?? new Date().toISOString().slice(0, 10);
    const days: BuilderDay[] = ((dayRows ?? []) as any[]).map((d, i) => {
      const meals = (byDay.get(d.id) ?? []).map((m: any) => {
        const ing = Array.isArray(m.ingredients_json) ? m.ingredients_json : [];
        return {
          slot: (m.meal_slot ?? "lunch") as BuilderMeal["slot"],
          name: m.name ?? "",
          description: m.description ?? null,
          ingredients: ing.map((x: any) => ({
            name: String(x?.name ?? ""),
            grams: Math.round(Number(x?.grams ?? x?.amount_g ?? 0)),
          })),
          kcal: m.kcal == null ? null : Number(m.kcal),
          protein_g: m.protein_g == null ? null : Number(m.protein_g),
          carbs_g: m.carbs_g == null ? null : Number(m.carbs_g),
          fat_g: m.fat_g == null ? null : Number(m.fat_g),
          library_meal_id: m.library_meal_id ?? null,
          is_locked: !!m.is_locked,
          portion_factor: 1,
          linked_prep_group: m.linked_prep_group ?? null,
          linked_partner_group: null,
        } as BuilderMeal;
      });
      return {
        name: `Tag ${i + 1}`,
        type: (d.day_type === "training" ? "training" : "rest") as "training" | "rest",
        typeOverride: true,
        meals,
        prepCoupleLunchDinner: false,
      };
    });

    const endIso = (plan as any).scheduled_end_date ?? start;
    return {
      plan_id: (plan as any).id,
      title: (plan as any).title ?? "Wochenplan",
      startDate: start,
      endDate: endIso,
      days,
    };
  });

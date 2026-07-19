import { roundKcal50 } from "@/features/nutrition-plan-ai/lib/plan.logic";
import type {
  ComputedGeneratedMeal,
  NutritionPlanGenerationResult,
  PersistNutritionPlanInput,
} from "@/features/nutrition-plan-ai/types";
import { coerceIngredients } from "@/lib/nutrition-engine.server";

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function persistGeneratedNutritionPlan(
  input: PersistNutritionPlanInput,
): Promise<NutritionPlanGenerationResult> {
  const {
    supabase,
    target,
    uploadedBy,
    apiKey,
    title,
    start,
    planDays,
    cleaned,
    unresolved,
    wishesData,
  } = input;
  const hasUnresolved = unresolved.length > 0;

  await supabase
    .from("nutrition_plans")
    .update({ status: "archived" })
    .eq("client_id", target)
    .eq("plan_type", "nutrition")
    .in("status", ["draft", "approved", "published"]);

  const totals = cleaned.reduce(
    (accumulator, day) => {
      for (const meal of day.meals) {
        accumulator.kcal += meal.kcal ?? 0;
        accumulator.protein += meal.protein_g ?? 0;
        accumulator.carbs += meal.carbs_g ?? 0;
        accumulator.fat += meal.fat_g ?? 0;
      }
      return accumulator;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const totalDays = Math.max(1, cleaned.length);
  const avgKcal = roundKcal50(totals.kcal / totalDays);
  const avgProtein = Math.round(totals.protein / totalDays);
  const avgCarbs = Math.round(totals.carbs / totalDays);
  const avgFat = Math.round(totals.fat / totalDays);

  const end = new Date(start);
  end.setDate(end.getDate() + totalDays - 1);
  const status: "draft" | "needs_review" = hasUnresolved ? "needs_review" : "draft";
  const baseTitle = title?.trim() || `Smart-Plan — ${new Date().toLocaleDateString("de-DE")}`;
  const planTitle = hasUnresolved ? `${baseTitle} (Prüfung nötig)` : baseTitle;

  const { data: planRow, error: planError } = await supabase
    .from("nutrition_plans")
    .insert({
      client_id: target,
      title: planTitle,
      plan_type: "nutrition",
      is_active: false,
      status,
      generated_by: "ai_auto",
      source: "smart_ai",
      uploaded_by: uploadedBy,
      file_path: `ai-generated/${target}/${Date.now()}.json`,
      file_name: "ai-generated.json",
      scheduled_start_date: toIsoDate(start),
      scheduled_end_date: toIsoDate(end),
      kcal: avgKcal,
      protein_g: avgProtein,
      carbs_g: avgCarbs,
      fat_g: avgFat,
    })
    .select("id")
    .single();

  if (planError || !planRow) {
    throw new Error(planError?.message ?? "Plan konnte nicht angelegt werden");
  }

  for (let dayIndex = 0; dayIndex < cleaned.length; dayIndex++) {
    const day = cleaned[dayIndex];
    const { data: dayRow, error: dayError } = await supabase
      .from("nutrition_plan_days")
      .insert({ plan_id: planRow.id, name: day.name, sort_order: dayIndex })
      .select("id")
      .single();
    if (dayError || !dayRow) continue;

    let snackCounter = 0;
    const mealRows = day.meals.map((meal: ComputedGeneratedMeal, mealIndex: number) => {
      let slotLabel: string;
      if (meal.slot === "breakfast") slotLabel = "Frühstück";
      else if (meal.slot === "lunch") slotLabel = "Mittagessen";
      else if (meal.slot === "dinner") slotLabel = "Abendessen";
      else {
        snackCounter += 1;
        slotLabel = `Snack ${snackCounter}`;
      }

      const ingredients = coerceIngredients(meal.ingredients ?? null);
      return {
        day_id: dayRow.id,
        name: `${day.name} — ${slotLabel}`,
        description: meal.description ?? null,
        ingredients_json: ingredients.length ? ingredients : null,
        compute_warnings: meal._compute_warnings ?? [],
        kcal: meal.kcal ?? null,
        protein_g: meal.protein_g ?? null,
        carbs_g: meal.carbs_g ?? null,
        fat_g: meal.fat_g ?? null,
        sort_order: mealIndex,
        data_source: meal._data_source ?? "db_verified",
        verified_ratio: meal._verified_ratio ?? 1,
      };
    });

    if (mealRows.length) {
      await supabase.from("nutrition_plan_meals").insert(mealRows);
    }
  }

  if (!hasUnresolved) {
    try {
      const { generateShoppingListForPlan } = await import("@/lib/shopping-list-engine.server");
      await generateShoppingListForPlan({
        supabase,
        apiKey,
        planId: planRow.id,
        windowDays: planDays,
      });
    } catch (error) {
      console.warn("Auto shopping list failed:", error);
    }
  }

  if (wishesData.length && !hasUnresolved) {
    const haystack = cleaned
      .flatMap((day) => day.meals.map((meal) => `${meal.name} ${meal.description ?? ""}`))
      .join(" | ")
      .toLowerCase();
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-zäöüß0-9 ]+/g, " ")
        .trim();
    const usedWishIds = wishesData
      .filter((wish) => {
        const key = normalize(wish.wish);
        return key && haystack.includes(key);
      })
      .map((wish) => wish.id);

    if (usedWishIds.length) {
      await supabase
        .from("meal_wishes")
        .update({ consumed_at: new Date().toISOString() })
        .in("id", usedWishIds);
    }
  }

  if (hasUnresolved) {
    try {
      const uniqueIngredients = Array.from(
        new Set(
          unresolved.map(
            (entry) =>
              `${entry.meal}: „${entry.name}"${entry.food_id ? ` (food_id="${entry.food_id}")` : ""}`,
          ),
        ),
      ).slice(0, 15);
      const note = `Smart-Plan ${planRow.id} wurde als NEEDS_REVIEW gespeichert. Zutaten ohne eindeutige food_id im Safe-Pool:\n- ${uniqueIngredients.join("\n- ")}`;
      const { data: coachRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");
      const rows = ((coachRoles as Array<{ user_id: string }> | null) ?? []).map((role) => ({
        coach_id: role.user_id,
        task_key: `plan_needs_review:${planRow.id}`,
        note,
      }));
      if (rows.length) {
        await supabase.from("coach_task_state").upsert(rows, {
          onConflict: "coach_id,task_key",
        });
      }
    } catch (error) {
      console.warn("coach_task_state alert failed:", error);
    }
  }

  return {
    ok: true,
    plan_id: planRow.id,
    status,
    needs_review: hasUnresolved,
    unresolved: hasUnresolved
      ? unresolved.slice(0, 20).map((entry) => ({
          meal: entry.meal,
          name: entry.name,
          food_id: entry.food_id,
        }))
      : [],
    days: cleaned.length,
    meals: cleaned.reduce((sum, day) => sum + day.meals.length, 0),
    avg_kcal: avgKcal,
    scheduled_start_date: toIsoDate(start),
    scheduled_end_date: toIsoDate(end),
  };
}

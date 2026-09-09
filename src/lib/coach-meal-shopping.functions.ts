import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";
import { shoppingIngredientLines } from "@/lib/shopping-list-ingredients.logic";
import { daysUntilNextShopping } from "@/lib/shopping-cycle";

export type CoachMealShoppingItem = {
  name: string;
  quantity: string;
  category: string;
};

export type CoachMealShoppingDish = {
  key: string;
  name: string;
  occurrences: number;
  shared: boolean;
  items: CoachMealShoppingItem[];
};

export type CoachMealShoppingPlan = {
  id: string;
  title: string;
  status: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  window_days: number;
  window_start_day: number;
  window_end_day: number;
  dishes: CoachMealShoppingDish[];
};

function cleanMealName(value: unknown) {
  const cleaned = String(value ?? "")
    .replace(/^🍽️\s*/u, "")
    .replace(/^gemeinsam\s+mit\s+[^—–-]+\s*[—–-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Gericht";
}

function rewriteIngredientLine(rawLine: string, combined: boolean): string | null {
  const line = String(rawLine ?? "").trim();
  if (!line) return null;

  // Partner-Pläne speichern gemeinsame Zutaten teilweise als:
  // "Putenhack: 200 g für Ich, 250 g für Nina — insgesamt 450 g".
  // In der gerichtbezogenen Einkaufssicht ist bei gemeinsamen Gerichten die
  // Haushaltsmenge relevant, nicht nur die Einzelportion.
  const shared = line.match(
    /^(.+?):\s*([\d.,]+)\s*(kg|g|ml|l|stück|stk\.?|scheiben?|el|tl)?\s*für\s+(?:ich|mich)\s*,\s*([\d.,]+)\s*(kg|g|ml|l|stück|stk\.?|scheiben?|el|tl)?\s*für\s+[^—–-]+\s*[—–-]\s*insgesamt\s*([\d.,]+)\s*(kg|g|ml|l|stück|stk\.?|scheiben?|el|tl)?/i,
  );
  if (shared) {
    const name = shared[1].trim();
    return combined
      ? `${shared[6]} ${shared[7] ?? "g"} ${name}`
      : `${shared[2]} ${shared[3] ?? "g"} ${name}`;
  }

  if (/^für\s+.+\binsgesamt\b/i.test(line)) return null;
  if (/^gemeinsam\s+mit\b/i.test(line)) return null;
  return line;
}

function dayOffsetForPlan(plan: any, totalDays: number, today: Date) {
  if (plan?.status !== "active" || !plan?.scheduled_start_date) return 0;
  const start = new Date(`${String(plan.scheduled_start_date).slice(0, 10)}T00:00:00`);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || current <= start) return 0;
  const elapsed = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, Math.min(Math.max(0, totalDays - 1), elapsed));
}

async function loadBreakdown(db: any, plan: any, windowDays: number, today: Date) {
  const { data: days, error: daysError } = await db
    .from("nutrition_plan_days")
    .select("id, sort_order")
    .eq("plan_id", plan.id)
    .order("sort_order");
  if (daysError) throw new Error(daysError.message);

  const allDays = (days ?? []) as any[];
  const startIndex = dayOffsetForPlan(plan, allDays.length, today);
  const selectedDays = allDays.slice(startIndex, startIndex + windowDays);
  const dayIds = selectedDays.map((day) => day.id);

  if (!dayIds.length) {
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      scheduled_start_date: plan.scheduled_start_date ?? null,
      scheduled_end_date: plan.scheduled_end_date ?? null,
      window_days: 0,
      window_start_day: startIndex + 1,
      window_end_day: startIndex,
      dishes: [],
    } satisfies CoachMealShoppingPlan;
  }

  const { data: meals, error: mealsError } = await db
    .from("nutrition_plan_meals")
    .select("day_id, name, recipe_ingredients, ingredients_json, sort_order, is_shared")
    .in("day_id", dayIds)
    .order("sort_order");
  if (mealsError) throw new Error(mealsError.message);

  const dayOrder = new Map(dayIds.map((id, index) => [id, index]));
  const orderedMeals = [...(meals ?? [])].sort(
    (a: any, b: any) =>
      (dayOrder.get(a.day_id) ?? 0) - (dayOrder.get(b.day_id) ?? 0) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const groups = new Map<
    string,
    { name: string; occurrences: number; shared: boolean; lines: string[]; order: number }
  >();

  orderedMeals.forEach((meal: any, index: number) => {
    const name = cleanMealName(meal.name);
    const key = name.toLocaleLowerCase("de-DE");
    const group = groups.get(key) ?? {
      name,
      occurrences: 0,
      shared: false,
      lines: [],
      order: index,
    };
    group.occurrences += 1;
    group.shared = group.shared || Boolean(meal.is_shared);
    const lines = shoppingIngredientLines(meal)
      .map((line) => rewriteIngredientLine(line, Boolean(meal.is_shared)))
      .filter((line): line is string => Boolean(line));
    group.lines.push(...lines);
    groups.set(key, group);
  });

  const { normalizeShoppingListItems } = await import("@/lib/shopping-list-engine.server");
  const dishes: CoachMealShoppingDish[] = [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, group]) => ({
      key,
      name: group.name,
      occurrences: group.occurrences,
      shared: group.shared,
      items: normalizeShoppingListItems(
        group.lines.map((line) => ({ name: line, quantity: "", category: "Sonstiges" })),
      ).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        category: item.category,
      })),
    }));

  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    scheduled_start_date: plan.scheduled_start_date ?? null,
    scheduled_end_date: plan.scheduled_end_date ?? null,
    window_days: selectedDays.length,
    window_start_day: startIndex + 1,
    window_end_day: startIndex + selectedDays.length,
    dishes,
  } satisfies CoachMealShoppingPlan;
}

export const getCoachMealShoppingBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    }

    const db =
      data.user_id === context.userId
        ? context.supabase
        : (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    const { data: plans, error: plansError } = await db
      .from("nutrition_plans")
      .select("id, client_id, title, status, scheduled_start_date, scheduled_end_date, created_at")
      .eq("client_id", data.user_id)
      .eq("plan_type", "nutrition")
      .eq("performance_context", false)
      .in("status", ["active", "draft", "approved", "published"])
      .order("created_at", { ascending: false });
    if (plansError) throw new Error(plansError.message);

    const rows = (plans ?? []) as any[];
    const activePlan = rows.find((plan) => plan.status === "active") ?? null;
    const nextPlan = rows.find((plan) => ["draft", "approved", "published"].includes(plan.status)) ?? null;

    const { data: profile } = await db
      .from("smart_nutrition_profile")
      .select("shopping_days")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const windowDays = daysUntilNextShopping((profile as any)?.shopping_days);
    const today = new Date();

    const [active, next] = await Promise.all([
      activePlan ? loadBreakdown(db, activePlan, windowDays, today) : Promise.resolve(null),
      nextPlan ? loadBreakdown(db, nextPlan, windowDays, today) : Promise.resolve(null),
    ]);

    return {
      active,
      next,
      default_plan_id: next?.id ?? active?.id ?? null,
    };
  });

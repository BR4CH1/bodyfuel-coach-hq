from pathlib import Path

ROOT = Path.cwd()


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, got {count}\n--- needle ---\n{old}")
    p.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count < minimum:
        raise RuntimeError(f"{path}: expected at least {minimum} matches for {old!r}, got {count}")
    p.write_text(text.replace(old, new))


# 1) One shared effective-target resolver for tracker + coach/server insights.
(ROOT / "src/lib/nutrition-tracker-targets.functions.ts").write_text(r'''import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";
import {
  computeTrackerTargetsFromPlan,
  isNutritionPlanActiveOnDate,
  type TrackerPlanDay,
  type TrackerPlanMeal,
} from "@/lib/nutrition-tracker-targets.logic";

export type EffectiveNutritionTargetRow = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
  kcal_rest: number | null;
  protein_g_rest: number | null;
  carbs_g_rest: number | null;
  fat_g_rest: number | null;
};

export type EffectiveNutritionTargetsResult = EffectiveNutritionTargetRow & {
  source: "active_plan" | "nutrition_targets";
  plan_id?: string;
};

function roundKcal(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(50, Math.round(number / 50) * 50) : 0;
}

function roundMacro(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/**
 * Single source of truth for personal nutrition targets.
 * An active nutrition plan wins inside its scheduled date range; nutrition_targets
 * remains the fallback outside that range or when no computable active plan exists.
 */
export async function loadEffectiveNutritionTargets(
  db: any,
  userId: string,
  date: string,
): Promise<EffectiveNutritionTargetsResult | null> {
  const [{ data: fallback, error: fallbackError }, { data: plan, error: planError }] =
    await Promise.all([
      db
        .from("nutrition_targets")
        .select(
          "kcal,protein_g,carbs_g,fat_g,water_glasses,kcal_rest,protein_g_rest,carbs_g_rest,fat_g_rest",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("nutrition_plans")
        .select(
          "id,kcal,protein_g,carbs_g,fat_g,scheduled_start_date,scheduled_end_date",
        )
        .eq("client_id", userId)
        .eq("plan_type", "nutrition")
        .eq("status", "active")
        .eq("performance_context", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (fallbackError) throw new Error(fallbackError.message);
  if (planError) throw new Error(planError.message);

  const fallbackTargets = fallback as EffectiveNutritionTargetRow | null;

  if (
    plan &&
    isNutritionPlanActiveOnDate(
      date,
      (plan as any).scheduled_start_date,
      (plan as any).scheduled_end_date,
    )
  ) {
    const { data: days, error: daysError } = await db
      .from("nutrition_plan_days")
      .select(
        "id,name,day_type,target_kcal,target_protein_g,target_carbs_g,target_fat_g",
      )
      .eq("plan_id", (plan as any).id);
    if (daysError) throw new Error(daysError.message);

    const dayRows = ((days ?? []) as TrackerPlanDay[]).filter((day) => Boolean(day.id));
    let mealRows: TrackerPlanMeal[] = [];
    if (dayRows.length) {
      const { data: meals, error: mealsError } = await db
        .from("nutrition_plan_meals")
        .select("day_id,kcal,protein_g,carbs_g,fat_g")
        .in(
          "day_id",
          dayRows.map((day) => day.id),
        );
      if (mealsError) throw new Error(mealsError.message);
      mealRows = (meals ?? []) as TrackerPlanMeal[];
    }

    const derived = computeTrackerTargetsFromPlan(dayRows, mealRows);
    if (derived) {
      return {
        ...derived,
        water_glasses: Number(fallbackTargets?.water_glasses) || 8,
        source: "active_plan",
        plan_id: (plan as any).id,
      };
    }

    // Plans without computable meal/day totals still have their aggregate plan target.
    const planKcal = roundKcal((plan as any).kcal);
    if (planKcal > 0) {
      return {
        kcal: planKcal,
        protein_g: roundMacro((plan as any).protein_g),
        carbs_g: roundMacro((plan as any).carbs_g),
        fat_g: roundMacro((plan as any).fat_g),
        water_glasses: Number(fallbackTargets?.water_glasses) || 8,
        kcal_rest: null,
        protein_g_rest: null,
        carbs_g_rest: null,
        fat_g_rest: null,
        source: "active_plan",
        plan_id: (plan as any).id,
      };
    }
  }

  if (!fallbackTargets) return null;
  return { ...fallbackTargets, source: "nutrition_targets" };
}

export const getNutritionTrackerTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; date: string }) => {
    if (!data?.user_id) throw new Error("user_id fehlt");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Ungültiges Datum");
    return data;
  })
  .handler(async ({ data, context }): Promise<EffectiveNutritionTargetsResult | null> => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    }

    // Use the server client only after the authenticated caller has been checked.
    // This lets tracker and coach tools resolve the exact same active-plan targets
    // without widening browser-side RLS permissions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadEffectiveNutritionTargets(supabaseAdmin, data.user_id, data.date);
  });
''')

# 2) Coach macro display now uses the same active-plan target resolver as tracking.
replace_once(
    "src/components/bodyfuel/MacroTargetsCard.tsx",
    'import { getNutritionTargets } from "@/lib/nutrition.functions";',
    'import { getNutritionTrackerTargets } from "@/lib/nutrition-tracker-targets.functions";',
)
replace_once(
    "src/components/bodyfuel/MacroTargetsCard.tsx",
    '  const getFn = useServerFn(getNutritionTargets);\n  const [t, setT] = useState<any | null>(null);',
    '  const getFn = useServerFn(getNutritionTrackerTargets);\n  const now = new Date();\n  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;\n  const [t, setT] = useState<any | null>(null);',
)
replace_once(
    "src/components/bodyfuel/MacroTargetsCard.tsx",
    '        const row = await getFn({ data: { user_id: userId } });',
    '        const row = await getFn({ data: { user_id: userId, date: today } });',
)
replace_once(
    "src/components/bodyfuel/MacroTargetsCard.tsx",
    '  }, [userId, getFn]);',
    '  }, [userId, getFn, today]);',
)
replace_once(
    "src/components/bodyfuel/MacroTargetsCard.tsx",
    '      subtitle={\n        hasRest\n          ? "Trainingstage und Restdays nutzen unterschiedliche Macros."\n          : "Aktuell ist kein Restday-Wert hinterlegt."\n      }',
    '      subtitle={\n        t.source === "active_plan"\n          ? "Werte aus dem aktuell gültigen Ernährungsplan."\n          : hasRest\n            ? "Fallback-Ziele: Trainingstage und Restdays nutzen unterschiedliche Macros."\n            : "Fallback-Ziele: Aktuell ist kein Restday-Wert hinterlegt."\n      }',
)

# 3) Make the fallback editor explicit whenever an active plan currently governs tracking.
replace_once(
    "src/components/bodyfuel/NutritionTargetsEditor.tsx",
    '} from "@/lib/nutrition.functions";\n',
    '} from "@/lib/nutrition.functions";\nimport { getNutritionTrackerTargets } from "@/lib/nutrition-tracker-targets.functions";\n',
)
replace_once(
    "src/components/bodyfuel/NutritionTargetsEditor.tsx",
    '  const qc = useQueryClient();\n\n  const { data: loaded, isLoading: loading } = useQuery({',
    '  const qc = useQueryClient();\n  const getEffectiveFn = useServerFn(getNutritionTrackerTargets);\n  const now = new Date();\n  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;\n\n  const { data: loaded, isLoading: loading } = useQuery({',
)
replace_once(
    "src/components/bodyfuel/NutritionTargetsEditor.tsx",
    '  const [kcal, setKcal] = useState(2200);',
    '  const { data: effective } = useQuery({\n    queryKey: ["nutrition-effective-targets", userId, today],\n    queryFn: () => getEffectiveFn({ data: { user_id: userId, date: today } }),\n  });\n\n  const [kcal, setKcal] = useState(2200);',
)
replace_once(
    "src/components/bodyfuel/NutritionTargetsEditor.tsx",
    '      <p className="mt-1 text-xs text-muted-foreground">\n        Vorgaben für Kalorien, Makros und Wasser. Kalorien werden auf 50-er-Schritte gerundet.\n      </p>\n      {loading ? (',
    '      <p className="mt-1 text-xs text-muted-foreground">\n        Vorgaben für Kalorien, Makros und Wasser. Kalorien werden auf 50-er-Schritte gerundet.\n      </p>\n      {effective?.source === "active_plan" && (\n        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">\n          <div className="font-semibold text-emerald-400">Aktiver Plan steuert aktuell das Tracking</div>\n          <div className="mt-1 text-muted-foreground">\n            Effektiv: {effective.kcal} kcal · P {effective.protein_g} g · KH {effective.carbs_g} g · F {effective.fat_g} g\n            {effective.kcal_rest != null ? ` · Restday ${effective.kcal_rest} kcal` : ""}. Die Felder unten sind Fallback-Ziele für Zeiten ohne aktiven Plan.\n          </div>\n        </div>\n      )}\n      {loading ? (',
)

# 4) Customer detail targets used by training/goal cards now match the tracker.
replace_once(
    "src/lib/coaching.functions.ts",
    '    const u = authUser;\n',
    '    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");\n    const effectiveTargets = await loadEffectiveNutritionTargets(\n      customerDb,\n      data.user_id,\n      new Date().toISOString().slice(0, 10),\n    );\n\n    const u = authUser;\n',
)
replace_once(
    "src/lib/coaching.functions.ts",
    '      targets: targets.data ?? null,',
    '      targets: effectiveTargets ?? targets.data ?? null,',
)

# 5) Smart nutrition risk flags compare against effective active-plan protein.
replace_once(
    "src/lib/coach-smart-insights.functions.ts",
    '    const today = new Date();\n    const since = new Date(today.getTime() - 14 * 24 * 3600 * 1000)',
    '    const today = new Date();\n    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");\n    const effectiveTargets = await loadEffectiveNutritionTargets(\n      supabase,\n      target,\n      today.toISOString().slice(0, 10),\n    );\n    const since = new Date(today.getTime() - 14 * 24 * 3600 * 1000)',
)
replace_once(
    "src/lib/coach-smart-insights.functions.ts",
    '        supabase\n          .from("nutrition_targets")\n          .select("kcal, protein_g")\n          .eq("user_id", target)\n          .maybeSingle(),',
    '        Promise.resolve({ data: effectiveTargets }),',
)

# 6) AI check-in: normal coaching profile/weight source + effective plan targets.
replace_once(
    "src/lib/checkin-ai.functions.ts",
    '      .select(\n        "first_name, last_name, gender, height_cm, current_weight_kg, target_weight_kg, goal, activity_level, birthdate",\n      )',
    '      .select(\n        "display_name, gender, height_cm, goal_weight_kg, coaching_goal, training_goal, activity_level, birthdate",\n      )',
)
replace_once(
    "src/lib/checkin-ai.functions.ts",
    '    const { data: weights } = await supabase\n      .from("bulls_weight_logs")\n      .select("log_date, weight_kg")\n      .eq("user_id", target)\n      .gte("log_date", since30)\n      .order("log_date", { ascending: false })\n      .limit(30);',
    '    const { data: weights } = await supabase\n      .from("body_measurements")\n      .select("measured_at, weight_kg")\n      .eq("user_id", target)\n      .not("weight_kg", "is", null)\n      .gte("measured_at", since30)\n      .order("measured_at", { ascending: false })\n      .limit(30);',
)
replace_once(
    "src/lib/checkin-ai.functions.ts",
    '    // Aktuelle Ziele\n    const { data: targets } = await supabase\n      .from("nutrition_targets")\n      .select("kcal, protein_g, carbs_g, fat_g")\n      .eq("user_id", target)\n      .maybeSingle();',
    '    // Aktuell tatsächlich gültige Ziele (aktiver Plan vor Fallback-Tabelle).\n    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");\n    const targets = await loadEffectiveNutritionTargets(\n      supabase,\n      target,\n      today.toISOString().slice(0, 10),\n    );',
)
replace_once(
    "src/lib/checkin-ai.functions.ts",
    '      profile,\n      checkins: checkins ?? [],',
    '      profile: { ...profile, current_weight_kg: weights?.[0]?.weight_kg ?? null },\n      checkins: checkins ?? [],',
)

# 7) Plan-adjustment analysis uses effective targets and the standard body measurement stream.
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    const today = new Date();\n    const since14 = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);',
    '    const today = new Date();\n    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");\n    const effectiveTargets = await loadEffectiveNutritionTargets(\n      supabase,\n      target,\n      today.toISOString().slice(0, 10),\n    );\n    const since14 = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '          .select(\n            "first_name, gender, height_cm, current_weight_kg, target_weight_kg, goal, activity_level, birthdate",\n          )',
    '          .select(\n            "display_name, gender, height_cm, goal_weight_kg, coaching_goal, training_goal, activity_level, birthdate",\n          )',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '        supabase\n          .from("nutrition_targets")\n          .select(\n            "kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest",\n          )\n          .eq("user_id", target)\n          .maybeSingle(),',
    '        Promise.resolve({ data: effectiveTargets }),',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '        supabase\n          .from("bulls_weight_logs")\n          .select("log_date, weight_kg")\n          .eq("user_id", target)\n          .gte("log_date", since30)\n          .order("log_date", { ascending: false }),',
    '        supabase\n          .from("body_measurements")\n          .select("measured_at, weight_kg")\n          .eq("user_id", target)\n          .not("weight_kg", "is", null)\n          .gte("measured_at", since30)\n          .order("measured_at", { ascending: false }),',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    const weights = (weightsRes.data ?? []) as Array<{ log_date: string; weight_kg: number }>;',
    '    const weights = (weightsRes.data ?? []) as Array<{ measured_at: string; weight_kg: number }>;',
)
replace_all(
    "src/lib/plan-adjustments.functions.ts",
    'weights[0].log_date',
    'weights[0].measured_at',
)
replace_all(
    "src/lib/plan-adjustments.functions.ts",
    'weights[weights.length - 1].log_date',
    'weights[weights.length - 1].measured_at',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    const profileForWeight = profileRes.data as { current_weight_kg?: unknown } | null;\n    const latestWeight = Number(weights[0]?.weight_kg ?? profileForWeight?.current_weight_kg);',
    '    const latestWeight = Number(weights[0]?.weight_kg);',
)

# Applying a nutrition adjustment must never pretend to mutate the currently active manual plan.
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    const { data: before } = await supabase\n      .from("nutrition_targets")\n      .select("kcal, protein_g, carbs_g, fat_g")\n      .eq("user_id", data.user_id)\n      .maybeSingle();',
    '    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");\n    const effectiveBefore = await loadEffectiveNutritionTargets(\n      supabase,\n      data.user_id,\n      new Date().toISOString().slice(0, 10),\n    );\n\n    const { data: before } = await supabase\n      .from("nutrition_targets")\n      .select("kcal, protein_g, carbs_g, fat_g")\n      .eq("user_id", data.user_id)\n      .maybeSingle();',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '      before_json: before ?? null,\n      after_json: {',
    '      before_json: effectiveBefore ?? before ?? null,\n      after_json: {',
)
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    return { ok: true };\n  });\n\nexport type TrainingApplyAction =',
    '    const appliesImmediately = effectiveBefore?.source !== "active_plan";\n    return {\n      ok: true,\n      applies_immediately: appliesImmediately,\n      active_plan_id: effectiveBefore?.source === "active_plan" ? effectiveBefore.plan_id ?? null : null,\n    };\n  });\n\nexport type TrainingApplyAction =',
)

# Current training plans live in nutrition_plans(plan_type=training), not a legacy training_plans table.
replace_once(
    "src/lib/plan-adjustments.functions.ts",
    '    const { data: plan } = await supabase\n      .from("training_plans")\n      .select("id")\n      .eq("client_id", data.user_id)\n      .eq("is_active", true)\n      .maybeSingle();',
    '    const { data: plan } = await supabase\n      .from("nutrition_plans")\n      .select("id")\n      .eq("client_id", data.user_id)\n      .eq("plan_type", "training")\n      .eq("status", "active")\n      .eq("performance_context", false)\n      .order("created_at", { ascending: false })\n      .limit(1)\n      .maybeSingle();',
)

# 8) Tell the coach truthfully whether a nutrition adjustment is immediate or only the next fallback basis.
replace_once(
    "src/components/bodyfuel/PlanAdjustmentsCard.tsx",
    '    onSuccess: ({ idx }) => {\n      toast.success("Ernährungsziele übernommen");\n      setAppliedNutritionFor(idx);',
    '    onSuccess: ({ r, idx }) => {\n      if ((r as any)?.applies_immediately) {\n        toast.success("Ernährungsziele übernommen");\n      } else {\n        toast.success("Neue Zielbasis gespeichert", {\n          description: "Der aktuell aktive Ernährungsplan bleibt unverändert. Die Werte gelten nach dem Planwechsel bzw. für den nächsten Plan.",\n        });\n      }\n      setAppliedNutritionFor(idx);',
)

# 9) Regression guard: no legacy sources in the two critical adjustment/check-in pipelines.
test_path = ROOT / "src/lib/__tests__/customer-subpoints-consistency.test.ts"
test_path.write_text(r'''import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(rel: string) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

describe("coach customer subpoint data consistency", () => {
  it("uses the shared effective nutrition target resolver in coach insight pipelines", () => {
    const smart = read("src/lib/coach-smart-insights.functions.ts");
    const checkin = read("src/lib/checkin-ai.functions.ts");
    const adjustments = read("src/lib/plan-adjustments.functions.ts");

    expect(smart).toContain("loadEffectiveNutritionTargets");
    expect(checkin).toContain("loadEffectiveNutritionTargets");
    expect(adjustments).toContain("loadEffectiveNutritionTargets");
  });

  it("does not use the Bulls-only weight stream for normal coach check-ins or adjustments", () => {
    expect(read("src/lib/checkin-ai.functions.ts")).not.toContain('.from("bulls_weight_logs")');
    expect(read("src/lib/plan-adjustments.functions.ts")).not.toContain('.from("bulls_weight_logs")');
  });

  it("applies training adjustments to the current unified training-plan table", () => {
    const adjustments = read("src/lib/plan-adjustments.functions.ts");
    expect(adjustments).not.toContain('.from("training_plans")');
    expect(adjustments).toContain('.eq("plan_type", "training")');
    expect(adjustments).toContain('.eq("status", "active")');
  });
});
''')

print("Customer subpoint consistency patch applied.")

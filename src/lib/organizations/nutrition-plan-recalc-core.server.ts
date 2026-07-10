/**
 * Server-only Kern-Logik für den Ernährungsplan-Recalc bei Belastungsänderungen.
 *
 * Wird von mehreren Server Fn Handlern importiert (nutrition-plan-recalc,
 * load-management, organization-events). Die Datei ist als `.server.ts`
 * markiert und darf ausschließlich innerhalb von Handler-Bodies via
 * dynamischem `await import(...)` geladen werden.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecalcReason =
  | "matchday_context"
  | "intensity_increase"
  | "intensity_decrease"
  | "md_minus_1_pre_fuel"
  | "recovery_context"
  | "rest_context"
  | "manual_override";

export type DirtyDayCategory =
  | "skipped_past"
  | "skipped_day_closed"
  | "fully_regenerable"
  | "partial_recalc"
  | "no_plan";

type MealBaseline = {
  id: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  name: string;
};

export type DirtyDayReport = {
  user_id: string;
  date: string;
  category: DirtyDayCategory;
  protected_meal_ids: string[];
  open_meal_ids: string[];
  load_level: number | null;
  factor_applied: number | null;
  overrides_written: number;
};

export const AUTO_SOURCE = "auto_load_recalc";

function loadFactor(level: number): number {
  const table: Record<number, number> = {
    0: 0.85, 1: 0.9, 2: 0.95, 3: 1.0, 4: 1.1, 5: 1.2,
  };
  return table[level] ?? 1.0;
}

function isPastDate(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return target < today;
}

async function assertCallerIsOrgStaffOrSelf(
  supabase: SupabaseClient,
  args: { callerId: string; orgId: string; targets: string[] },
): Promise<void> {
  if (args.targets.length === 1 && args.targets[0] === args.callerId) return;
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("role")
    .eq("organization_id", args.orgId)
    .eq("user_id", args.callerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not org staff");
}

async function resolveAffectedAthletes(
  supabase: SupabaseClient,
  orgId: string,
  teamId: string | null,
  scopeUserId: string | null,
): Promise<string[]> {
  if (scopeUserId) return [scopeUserId];
  if (teamId) {
    const { data } = await supabase
      .from("team_memberships")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "active");
    return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  }
  const { data } = await supabase
    .from("organization_memberships")
    .select("user_id, status, role")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .eq("role", "athlete");
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

async function resolveLoadLevelForUserDate(
  supabase: SupabaseClient,
  args: { orgId: string; userId: string; date: string },
): Promise<number | null> {
  const { data: ov } = await supabase
    .from("organization_load_day_athlete_overrides")
    .select("load_level")
    .eq("organization_id", args.orgId)
    .eq("user_id", args.userId)
    .eq("date", args.date)
    .maybeSingle();
  if (ov) return (ov as { load_level: number }).load_level;

  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("team_id, organization_teams!inner(organization_id)")
    .eq("user_id", args.userId)
    .eq("status", "active")
    .eq("organization_teams.organization_id", args.orgId);
  const teamIds = ((memberships ?? []) as Array<{ team_id: string }>).map((m) => m.team_id);

  const { data: rows } = await supabase
    .from("organization_load_days")
    .select("load_level, team_id")
    .eq("organization_id", args.orgId)
    .eq("date", args.date);
  const list = (rows ?? []) as Array<{ load_level: number; team_id: string | null }>;
  if (teamIds.length > 0) {
    const teamHit = list.find((r) => r.team_id && teamIds.includes(r.team_id));
    if (teamHit) return teamHit.load_level;
  }
  const orgHit = list.find((r) => r.team_id === null);
  return orgHit ? orgHit.load_level : null;
}

async function classifyAndCollectMeals(
  supabase: SupabaseClient,
  params: { userId: string; date: string },
): Promise<{ category: DirtyDayCategory; protected_ids: string[]; open: MealBaseline[] }> {
  const { userId, date } = params;
  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const planId = ((plans ?? [])[0] as { id?: string } | undefined)?.id;
  if (!planId) return { category: "no_plan", protected_ids: [], open: [] };

  const { data: dayRows } = await supabase
    .from("nutrition_plan_days")
    .select("id, day_date")
    .eq("plan_id", planId)
    .eq("day_date", date);
  const dayId = ((dayRows ?? [])[0] as { id?: string } | undefined)?.id;
  if (!dayId) return { category: "no_plan", protected_ids: [], open: [] };

  const [mealsRes, overridesRes, entriesRes] = await Promise.all([
    supabase
      .from("nutrition_plan_meals")
      .select("id, name, meal_slot, is_locked, kcal, protein_g, carbs_g, fat_g")
      .eq("day_id", dayId),
    supabase
      .from("nutrition_plan_meal_overrides")
      .select("plan_meal_id, source")
      .eq("user_id", userId)
      .eq("override_date", date),
    supabase
      .from("food_entries")
      .select("meal")
      .eq("user_id", userId)
      .eq("entry_date", date),
  ]);
  const meals = (mealsRes.data ?? []) as Array<{
    id: string;
    name: string;
    meal_slot: string | null;
    is_locked: boolean;
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  }>;
  const manualOverrideIds = new Set(
    ((overridesRes.data ?? []) as Array<{ plan_meal_id: string; source: string | null }>)
      .filter((r) => (r.source ?? "") !== AUTO_SOURCE)
      .map((r) => r.plan_meal_id),
  );
  const trackedSlots = new Set(
    ((entriesRes.data ?? []) as Array<{ meal: string }>).map((r) => r.meal),
  );
  const protectedIds: string[] = [];
  const open: MealBaseline[] = [];
  for (const m of meals) {
    const trackedForSlot = m.meal_slot ? trackedSlots.has(m.meal_slot) : false;
    if (m.is_locked || manualOverrideIds.has(m.id) || trackedForSlot) {
      protectedIds.push(m.id);
    } else {
      open.push({
        id: m.id,
        name: m.name,
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
      });
    }
  }
  const category: DirtyDayCategory =
    protectedIds.length === 0
      ? "fully_regenerable"
      : open.length === 0
        ? "skipped_day_closed"
        : "partial_recalc";
  return { category, protected_ids: protectedIds, open };
}

async function writeAutoOverrides(
  admin: SupabaseClient,
  args: { userId: string; date: string; open: MealBaseline[]; factor: number },
): Promise<number> {
  await admin
    .from("nutrition_plan_meal_overrides")
    .delete()
    .eq("user_id", args.userId)
    .eq("override_date", args.date)
    .eq("source", AUTO_SOURCE);
  if (args.factor === 1.0) return 0;
  const rows = args.open.map((m) => ({
    user_id: args.userId,
    plan_meal_id: m.id,
    override_date: args.date,
    name: m.name,
    kcal: m.kcal == null ? null : Math.round(m.kcal * args.factor),
    protein_g: m.protein_g == null ? null : Math.round(m.protein_g * args.factor * 10) / 10,
    carbs_g: m.carbs_g == null ? null : Math.round(m.carbs_g * args.factor * 10) / 10,
    fat_g: m.fat_g == null ? null : Math.round(m.fat_g * args.factor * 10) / 10,
    source: AUTO_SOURCE,
  }));
  if (rows.length === 0) return 0;
  const { error } = await admin.from("nutrition_plan_meal_overrides").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

async function writeHistory(
  admin: SupabaseClient,
  args: {
    coachId: string;
    userId: string;
    reason: RecalcReason;
    date: string;
    report: DirtyDayReport;
  },
): Promise<void> {
  const summary =
    args.report.overrides_written > 0
      ? `Deine Ernährung für ${args.date} wurde an die geänderte Belastungsplanung angepasst (${args.report.overrides_written} Mahlzeiten, Faktor ${args.report.factor_applied}).`
      : `Belastungsänderung für ${args.date} erkannt — keine Anpassung nötig (${args.report.category}).`;
  await admin.from("plan_adjustment_history").insert({
    client_id: args.userId,
    coach_id: args.coachId,
    kind: `load_change:${args.reason}`,
    area: "nutrition",
    summary,
    rationale: `Auto-Recalc protection-aware. Kategorie: ${args.report.category}. Load-Level: ${args.report.load_level}.`,
    after_json: {
      date: args.date,
      category: args.report.category,
      load_level: args.report.load_level,
      factor: args.report.factor_applied,
      open_meal_ids: args.report.open_meal_ids,
      protected_meal_ids: args.report.protected_meal_ids,
      overrides_written: args.report.overrides_written,
    },
  });
}

export async function runNutritionRecalc(
  authSupabase: SupabaseClient,
  args: {
    callerId: string;
    orgId: string;
    teamId?: string | null;
    userId?: string | null;
    dates: string[];
    reason: RecalcReason;
  },
): Promise<{ affected_users: number; reports: DirtyDayReport[] }> {
  const users = await resolveAffectedAthletes(
    authSupabase,
    args.orgId,
    args.teamId ?? null,
    args.userId ?? null,
  );
  await assertCallerIsOrgStaffOrSelf(authSupabase, {
    callerId: args.callerId,
    orgId: args.orgId,
    targets: users,
  });
  const dates = Array.from(new Set(args.dates)).filter((d) => !isPastDate(d));
  if (users.length === 0 || dates.length === 0) {
    return { affected_users: 0, reports: [] };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reports: DirtyDayReport[] = [];
  for (const userId of users) {
    for (const date of dates) {
      const { category, protected_ids, open } = await classifyAndCollectMeals(
        supabaseAdmin,
        { userId, date },
      );
      const loadLevel = await resolveLoadLevelForUserDate(supabaseAdmin, {
        orgId: args.orgId,
        userId,
        date,
      });
      const factor = loadLevel == null ? 1.0 : loadFactor(loadLevel);
      let overridesWritten = 0;
      if (
        (category === "fully_regenerable" || category === "partial_recalc") &&
        open.length > 0
      ) {
        overridesWritten = await writeAutoOverrides(supabaseAdmin, {
          userId,
          date,
          open,
          factor,
        });
      } else {
        await supabaseAdmin
          .from("nutrition_plan_meal_overrides")
          .delete()
          .eq("user_id", userId)
          .eq("override_date", date)
          .eq("source", AUTO_SOURCE);
      }
      const report: DirtyDayReport = {
        user_id: userId,
        date,
        category,
        protected_meal_ids: protected_ids,
        open_meal_ids: open.map((m) => m.id),
        load_level: loadLevel,
        factor_applied: factor,
        overrides_written: overridesWritten,
      };
      reports.push(report);
      if (overridesWritten > 0) {
        await writeHistory(supabaseAdmin, {
          coachId: args.callerId,
          userId,
          reason: args.reason,
          date,
          report,
        });
      }
    }
  }
  return { affected_users: users.length, reports };
}

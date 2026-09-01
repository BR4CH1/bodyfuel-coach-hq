import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

export type WeeklyTrainingActivityType =
  | "class"
  | "home_workout"
  | "cardio"
  | "mobility"
  | "other";

export type WeeklyTrainingActivity = {
  id: string;
  type: WeeklyTrainingActivityType;
  title: string;
  time?: string | null;
  notes?: string | null;
};

export type WeeklyTrainingDayPlan = {
  weekday: number; // 0=Sun..6=Sat
  stepTarget: number | null;
  activities: WeeklyTrainingActivity[];
};

export type AthleteWeeklyTrainingPlan = {
  userId: string;
  displayName: string | null;
  defaultStepTarget: number | null;
  storageReady: boolean;
  days: WeeklyTrainingDayPlan[];
};

const ACTIVITY_TYPES = new Set<WeeklyTrainingActivityType>([
  "class",
  "home_workout",
  "cardio",
  "mobility",
  "other",
]);

function clampStepTarget(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100000, Math.round(n)));
}

function cleanActivities(value: unknown): WeeklyTrainingActivity[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 12)
    .map((raw: any, index): WeeklyTrainingActivity | null => {
      const type = ACTIVITY_TYPES.has(raw?.type) ? raw.type : "other";
      const title = String(raw?.title ?? "").trim().slice(0, 120);
      if (!title) return null;
      const id = String(raw?.id ?? "").trim().slice(0, 100) || `activity-${index + 1}`;
      const time = String(raw?.time ?? "").trim().slice(0, 10) || null;
      const notes = String(raw?.notes ?? "").trim().slice(0, 300) || null;
      return { id, type, title, time, notes };
    })
    .filter((item): item is WeeklyTrainingActivity => Boolean(item));
}

function isMissingWeeklyActivityPlanTable(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? error?.details ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("athlete_weekly_activity_plan") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

async function assertSelfOrCoach(
  context: { userId: string; supabase: any },
  athleteId: string,
) {
  if (context.userId === athleteId) return;
  await assertCoachOrOrgStaffForAthlete(context as any, athleteId, "training");
}

export const getAthleteWeeklyTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }): Promise<AthleteWeeklyTrainingPlan> => {
    await assertSelfOrCoach(context as any, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: rows, error }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name, daily_step_goal")
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("athlete_weekly_activity_plan" as any)
        .select("weekday, step_target, activities")
        .eq("user_id", data.userId)
        .order("weekday"),
    ]);
    if (error && !isMissingWeeklyActivityPlanTable(error)) throw error;

    const storageReady = !error;
    const defaultStepTarget = clampStepTarget((profile as any)?.daily_step_goal);
    const byWeekday = new Map<number, any>();
    for (const row of ((storageReady ? rows : []) ?? []) as any[]) {
      const weekday = Number(row.weekday);
      if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) byWeekday.set(weekday, row);
    }

    const days: WeeklyTrainingDayPlan[] = Array.from({ length: 7 }, (_, weekday) => {
      const row = byWeekday.get(weekday);
      return {
        weekday,
        // Existing global profile goal is the sensible starting value. Once the
        // coach saves, every weekday becomes an explicit plan target.
        stepTarget: row ? clampStepTarget(row.step_target) : defaultStepTarget,
        activities: cleanActivities(row?.activities),
      };
    });

    return {
      userId: data.userId,
      displayName: (profile as any)?.display_name ?? null,
      defaultStepTarget,
      storageReady,
      days,
    };
  });

export const saveAthleteWeeklyTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; days: WeeklyTrainingDayPlan[] }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertCoachOrOrgStaffForAthlete(context, data.userId, "training");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const incoming = new Map<number, WeeklyTrainingDayPlan>();
    for (const raw of Array.isArray(data.days) ? data.days : []) {
      const weekday = Number(raw?.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
      incoming.set(weekday, {
        weekday,
        stepTarget: clampStepTarget(raw?.stepTarget),
        activities: cleanActivities(raw?.activities),
      });
    }

    const now = new Date().toISOString();
    const rows = Array.from({ length: 7 }, (_, weekday) => {
      const day = incoming.get(weekday) ?? { weekday, stepTarget: null, activities: [] };
      return {
        user_id: data.userId,
        weekday,
        step_target: day.stepTarget,
        activities: day.activities,
        updated_at: now,
      };
    });

    const { error } = await supabaseAdmin
      .from("athlete_weekly_activity_plan" as any)
      .upsert(rows as any, { onConflict: "user_id,weekday" });
    if (error) {
      if (isMissingWeeklyActivityPlanTable(error)) {
        throw new Error(
          "Wochenziele können noch nicht gespeichert werden, weil die Datenbankmigration für athlete_weekly_activity_plan noch nicht aktiv ist.",
        );
      }
      throw error;
    }

    return { ok: true };
  });

export const WEEKLY_TRAINING_ACTIVITY_LABELS: Record<WeeklyTrainingActivityType, string> = {
  class: "Kurs",
  home_workout: "Home Workout",
  cardio: "Cardio",
  mobility: "Mobility",
  other: "Aktivität",
};

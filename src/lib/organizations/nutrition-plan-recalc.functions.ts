import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecalcReason, DirtyDayReport } from "./nutrition-plan-recalc-core.server";

export type { RecalcReason, DirtyDayReport };

/**
 * Öffentliche Server Fn — von Coach-/Athlet-Mutationen (fire-and-forget)
 * oder direkt aus der UI aufrufbar. Kernlogik in
 * `nutrition-plan-recalc-core.server.ts`.
 */
export const recalcNutritionForDirtyDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      teamId?: string | null;
      userId?: string | null;
      dates: string[];
      reason: RecalcReason;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { runNutritionRecalc } = await import("./nutrition-plan-recalc-core.server");
    return runNutritionRecalc(context.supabase, {
      callerId: context.userId,
      orgId: data.orgId,
      teamId: data.teamId ?? null,
      userId: data.userId ?? null,
      dates: data.dates,
      reason: data.reason,
    });
  });

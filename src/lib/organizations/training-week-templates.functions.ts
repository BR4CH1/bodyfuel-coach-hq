/**
 * Wochenvorlagen (Coach-Bereich).
 *
 * Ganze Wochenpläne (7 Tage inkl. Sessions) als wiederverwendbare Vorlage speichern.
 * Vorlagen sind organisationsgebunden. Anwenden auf eine Woche schreibt die
 * Sessions relativ zum Wochenstart in das aktuelle Editor-Modell (Client-seitig).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TrainingFocus } from "@/lib/training-focus-detection";

export type WeekTemplateSession = {
  weekday: number; // 0 = Montag, 6 = Sonntag
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  focus: TrainingFocus | null;
  focus_source: "auto" | "manual" | "none" | null;
};

async function assertOrgAccess(
  ctx: { supabase: any; userId: string },
  orgId: string,
) {
  const { resolveCoachTeamScope } = await import("./coach-team-scope");
  await resolveCoachTeamScope(ctx.supabase, ctx.userId, orgId);
}

export const listWeekTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context, data.organization_id);
    const { data: rows, error } = await context.supabase
      .from("org_training_week_template")
      .select("id, name, description, sessions, created_at, updated_at")
      .eq("organization_id", data.organization_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      sessions: WeekTemplateSession[];
      created_at: string;
      updated_at: string;
    }>;
  });

export const createWeekTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organization_id: string;
      name: string;
      description?: string | null;
      sessions: WeekTemplateSession[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context, data.organization_id);
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Vorlagenname darf nicht leer sein.");
    if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
      throw new Error("Wochenvorlage enthält keine Trainings.");
    }
    const { data: row, error } = await context.supabase
      .from("org_training_week_template")
      .insert({
        organization_id: data.organization_id,
        created_by: context.userId,
        name,
        description: data.description ?? null,
        sessions: data.sessions as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const updateWeekTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id: string;
      patch: Partial<{
        name: string;
        description: string | null;
        sessions: WeekTemplateSession[];
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const cur = await context.supabase
      .from("org_training_week_template")
      .select("id, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur.data) throw new Error("Wochenvorlage nicht gefunden.");
    await assertOrgAccess(context, (cur.data as any).organization_id);
    const patch: any = { ...data.patch };
    if (patch.name !== undefined) {
      const n = (patch.name ?? "").trim();
      if (!n) throw new Error("Vorlagenname darf nicht leer sein.");
      patch.name = n;
    }
    const { error } = await context.supabase
      .from("org_training_week_template")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWeekTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const cur = await context.supabase
      .from("org_training_week_template")
      .select("id, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur.data) return { ok: true };
    await assertOrgAccess(context, (cur.data as any).organization_id);
    const { error } = await context.supabase
      .from("org_training_week_template")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

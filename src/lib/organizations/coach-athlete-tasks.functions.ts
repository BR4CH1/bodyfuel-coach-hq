import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Coach-Aktionen auf organization_tasks für einen einzelnen Athleten.
 * RLS erlaubt Schreiben durch: is_org_admin, is_org_staff('manage_training'), has_role('coach').
 * Wir prüfen zusätzlich hier serverseitig, damit Fehler klar erkennbar sind.
 */

async function assertCoachAccess(
  supabase: any,
  callerId: string,
  orgId: string,
): Promise<void> {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: callerId,
    _role: "coach",
  });
  if (isCoach) return;
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("user_id", callerId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!staff) throw new Error("Kein Zugriff auf diese Aufgabe.");
}

const createSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(500).optional().nullable(),
  scheduledFor: z.string().min(4), // ISO
  taskType: z.string().trim().max(64).optional().default("custom"),
});

export const createAthleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertCoachAccess(supabase, callerId, data.orgId);

    const { data: row, error } = await supabase
      .from("organization_tasks")
      .insert({
        organization_id: data.orgId,
        user_id: data.userId,
        assignee_user_id: data.userId,
        task_type: data.taskType ?? "custom",
        title: data.title,
        subtitle: data.subtitle ?? null,
        scheduled_for: data.scheduledFor,
        status: "open",
        assign_scope: "athlete",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

const updateSchema = z.object({
  taskId: z.string().uuid(),
  orgId: z.string().uuid(),
  patch: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: z.string().trim().max(500).nullable().optional(),
    scheduledFor: z.string().min(4).optional(),
    status: z.enum(["open", "in_progress", "done", "missed"]).optional(),
  }),
});

export const updateAthleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertCoachAccess(supabase, callerId, data.orgId);
    const update: Record<string, unknown> = {};
    if (data.patch.title !== undefined) update.title = data.patch.title;
    if (data.patch.subtitle !== undefined) update.subtitle = data.patch.subtitle;
    if (data.patch.scheduledFor !== undefined) update.scheduled_for = data.patch.scheduledFor;
    if (data.patch.status !== undefined) update.status = data.patch.status;
    const { error } = await supabase
      .from("organization_tasks")
      .update(update)
      .eq("id", data.taskId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({
  taskId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const deleteAthleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertCoachAccess(supabase, callerId, data.orgId);
    const { error } = await supabase
      .from("organization_tasks")
      .delete()
      .eq("id", data.taskId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

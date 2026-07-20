/**
 * Trainings-Session-Vorlagen (Coach-Bereich).
 *
 * Coaches speichern Trainingseinheiten (Titel, Fokus, Dauer, Beschreibung) als
 * wiederverwendbare Vorlage. Vorlagen sind organisationsgebunden. Das Löschen einer
 * Vorlage berührt keine bereits erstellten `org_team_training_week_session`-Zeilen
 * — die sind eigenständige Kopien.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TrainingFocus } from "@/lib/training-focus-detection";

async function assertOrgAccess(
  ctx: { supabase: any; userId: string },
  orgId: string,
) {
  const { resolveCoachTeamScope } = await import("./coach-team-scope");
  // Wirft, wenn der User keinerlei Team-/Org-Rechte hat.
  await resolveCoachTeamScope(ctx.supabase, ctx.userId, orgId);
}

export const listTrainingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context, data.organization_id);
    const { data: rows, error } = await context.supabase
      .from("org_training_session_template")
      .select("id, name, title, description, focus, duration_min, start_time, end_time, notes, created_at, updated_at")
      .eq("organization_id", data.organization_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const createTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      name: string;
      title: string;
      focus: TrainingFocus;
      description?: string | null;
      duration_min?: number | null;
      start_time?: string | null;
      end_time?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context, data.organization_id);
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Vorlagenname darf nicht leer sein.");
    const { data: row, error } = await context.supabase
      .from("org_training_session_template")
      .insert({
        organization_id: data.organization_id,
        created_by: context.userId,
        name,
        title: (data.title ?? "").trim() || name,
        description: data.description ?? null,
        focus: data.focus ?? "none",
        duration_min: data.duration_min ?? null,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const updateTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{
        name: string;
        title: string;
        description: string | null;
        focus: TrainingFocus;
        duration_min: number | null;
        start_time: string | null;
        end_time: string | null;
        notes: string | null;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    // Access wird per RLS erzwungen; wir prüfen zusätzlich, dass die Vorlage existiert.
    const cur = await context.supabase
      .from("org_training_session_template")
      .select("id, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur.data) throw new Error("Vorlage nicht gefunden.");
    await assertOrgAccess(context, (cur.data as any).organization_id);
    const patch: any = { ...data.patch };
    if (patch.name !== undefined) {
      const n = (patch.name ?? "").trim();
      if (!n) throw new Error("Vorlagenname darf nicht leer sein.");
      patch.name = n;
    }
    const { error } = await context.supabase
      .from("org_training_session_template")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const cur = await context.supabase
      .from("org_training_session_template")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur.data) throw new Error("Vorlage nicht gefunden.");
    const t = cur.data as any;
    await assertOrgAccess(context, t.organization_id);
    const { data: row, error } = await context.supabase
      .from("org_training_session_template")
      .insert({
        organization_id: t.organization_id,
        created_by: context.userId,
        name: `${t.name} (Kopie)`,
        title: t.title,
        description: t.description,
        focus: t.focus,
        duration_min: t.duration_min,
        start_time: t.start_time,
        end_time: t.end_time,
        notes: t.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const deleteTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const cur = await context.supabase
      .from("org_training_session_template")
      .select("id, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur.data) return { ok: true };
    await assertOrgAccess(context, (cur.data as any).organization_id);
    const { error } = await context.supabase
      .from("org_training_session_template")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Hinweis: bereits veröffentlichte Sessions (org_team_training_week_session /
    // athlete_training_session) sind Kopien und bleiben unberührt.
    return { ok: true };
  });

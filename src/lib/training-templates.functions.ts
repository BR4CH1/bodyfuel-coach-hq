import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertGlobalCoachOrAnyOrgCoach } from "@/lib/organizations/org-coach-access";
import {
  persistTrainingPlan,
  type BuilderTrainingDay,
} from "@/lib/training-plan-builder.functions";

export type TrainingTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  weeks_count: number;
  current_version: number;
  is_archived: boolean;
  updated_at: string;
  created_at: string;
};

export type TrainingTemplateDetail = TrainingTemplateSummary & {
  days: BuilderTrainingDay[];
  version_id: string;
  version: number;
};

// ---------- List ----------
export const listTrainingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainingTemplateSummary[]> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("training_plan_templates" as any)
      .select("id, name, description, tags, weeks_count, current_version, is_archived, updated_at, created_at")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as TrainingTemplateSummary[];
  });

// ---------- Get with latest version structure ----------
export const getTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string }) => d)
  .handler(async ({ data, context }): Promise<TrainingTemplateDetail> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl, error } = await supabaseAdmin
      .from("training_plan_templates" as any)
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error || !tpl) throw new Error(error?.message ?? "Vorlage nicht gefunden");
    const t = tpl as any;
    const { data: verRow, error: vErr } = await supabaseAdmin
      .from("training_template_versions" as any)
      .select("id, version, structure")
      .eq("template_id", data.templateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr || !verRow) throw new Error("Keine Version vorhanden");
    const v = verRow as any;
    const structure = v.structure ?? {};
    return {
      id: t.id, name: t.name, description: t.description, tags: t.tags ?? [],
      weeks_count: t.weeks_count, current_version: t.current_version,
      is_archived: t.is_archived, updated_at: t.updated_at, created_at: t.created_at,
      version_id: v.id, version: v.version,
      days: (structure.days ?? []) as BuilderTrainingDay[],
    };
  });

// ---------- Save as template (create OR new version) ----------
export const saveAsTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    templateId?: string | null;
    name: string;
    description?: string | null;
    tags?: string[];
    weeksCount: number;
    days: BuilderTrainingDay[];
    note?: string | null;
  }) => d)
  .handler(async ({ data, context }): Promise<{ template_id: string; version: number }> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let templateId = data.templateId ?? null;
    let nextVersion = 1;

    if (templateId) {
      const { data: cur } = await supabaseAdmin
        .from("training_plan_templates" as any)
        .select("current_version")
        .eq("id", templateId)
        .maybeSingle();
      nextVersion = Number((cur as any)?.current_version ?? 0) + 1;
      await supabaseAdmin
        .from("training_plan_templates" as any)
        .update({
          name: data.name.slice(0, 200),
          description: data.description ?? null,
          tags: data.tags ?? [],
          weeks_count: data.weeksCount,
          current_version: nextVersion,
        })
        .eq("id", templateId);
    } else {
      const { data: ins, error: iErr } = await supabaseAdmin
        .from("training_plan_templates" as any)
        .insert({
          owner_user_id: context.userId,
          name: data.name.slice(0, 200),
          description: data.description ?? null,
          tags: data.tags ?? [],
          weeks_count: data.weeksCount,
          current_version: 1,
        })
        .select("id")
        .single();
      if (iErr || !ins) throw new Error(iErr?.message ?? "Vorlage konnte nicht angelegt werden");
      templateId = (ins as any).id as string;
      nextVersion = 1;
    }

    const { error: vErr } = await supabaseAdmin
      .from("training_template_versions" as any)
      .insert({
        template_id: templateId,
        version: nextVersion,
        structure: { days: data.days },
        note: data.note ?? null,
        created_by: context.userId,
      });
    if (vErr) throw new Error(vErr.message);

    return { template_id: templateId!, version: nextVersion };
  });

// ---------- Rename ----------
export const renameTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string; name: string; description?: string | null; tags?: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("training_plan_templates" as any)
      .update({
        name: data.name.slice(0, 200),
        description: data.description ?? null,
        ...(data.tags ? { tags: data.tags } : {}),
      })
      .eq("id", data.templateId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Duplicate ----------
export const duplicateTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string }) => d)
  .handler(async ({ data, context }): Promise<{ template_id: string }> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src } = await supabaseAdmin
      .from("training_plan_templates" as any).select("*").eq("id", data.templateId).maybeSingle();
    if (!src) throw new Error("Vorlage nicht gefunden");
    const { data: ver } = await supabaseAdmin
      .from("training_template_versions" as any)
      .select("structure")
      .eq("template_id", data.templateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const s = src as any;
    const { data: ins, error } = await supabaseAdmin
      .from("training_plan_templates" as any)
      .insert({
        owner_user_id: context.userId,
        name: `${s.name} (Kopie)`.slice(0, 200),
        description: s.description,
        tags: s.tags ?? [],
        weeks_count: s.weeks_count,
        current_version: 1,
      })
      .select("id")
      .single();
    if (error || !ins) throw new Error(error?.message ?? "Kopie fehlgeschlagen");
    const newId = (ins as any).id as string;
    await supabaseAdmin
      .from("training_template_versions" as any)
      .insert({
        template_id: newId,
        version: 1,
        structure: (ver as any)?.structure ?? { days: [] },
        note: "Duplikat",
        created_by: context.userId,
      });
    return { template_id: newId };
  });

// ---------- Delete (soft archive) ----------
export const deleteTrainingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("training_plan_templates" as any)
      .update({ is_archived: true })
      .eq("id", data.templateId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Assign to athlete (materialize LIVE plan) ----------
export const assignTemplateToAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    templateId: string;
    customerId: string;
    startDate: string; // ISO Monday
    title?: string | null;
    publish?: boolean;
  }) => d)
  .handler(async ({ data, context }): Promise<{ plan_id: string }> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tpl } = await supabaseAdmin
      .from("training_plan_templates" as any).select("*").eq("id", data.templateId).maybeSingle();
    if (!tpl) throw new Error("Vorlage nicht gefunden");
    const { data: ver } = await supabaseAdmin
      .from("training_template_versions" as any)
      .select("id, version, structure")
      .eq("template_id", data.templateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ver) throw new Error("Vorlage hat keine Version");

    const t = tpl as any;
    const v = ver as any;
    const days = (v.structure?.days ?? []) as BuilderTrainingDay[];
    const res = await persistTrainingPlan({
      customerId: data.customerId,
      uploadedBy: context.userId,
      title: (data.title ?? t.name).slice(0, 200),
      startDate: data.startDate,
      weeksCount: Number(t.weeks_count) || 1,
      days,
      publish: !!data.publish,
      sourceTemplateId: t.id,
      sourceTemplateVersionId: v.id,
    });

    return { plan_id: res.plan_id };
  });

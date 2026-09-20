import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BuilderDay } from "@/lib/plan-builder.functions";

/** Im Template mitgespeicherte Builder-Einstellungen. */
export type NutritionPlanTemplateConfig = {
  goal?: string;
  dietRules?: string[];
  exclusionGroups?: string[];
  customExclusions?: string[];
  preferences?: string[];
  lifestyle?: string[];
  mealsPerDay?: number;
  /** Variationsgrad: niedrig | mittel | hoch. */
  variation?: string;
};

export type NutritionPlanTemplate = {
  id: string;
  title: string;
  notes: string | null;
  plan_days: number;
  days: BuilderDay[];
  partner_days: BuilderDay[] | null;
  shared_slots: Record<string, boolean> | null;
  config: NutritionPlanTemplateConfig | null;
  updated_at: string;
};

const asDays = (value: unknown): BuilderDay[] =>
  Array.isArray(value) ? (value as BuilderDay[]) : [];

/** Alle Wochenplan-Vorlagen des angemeldeten Coaches, neueste zuerst. */
export const listNutritionPlanTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NutritionPlanTemplate[]> => {
    const { data, error } = await context.supabase
      .from("nutrition_plan_templates")
      .select("id, title, notes, plan_days, days, partner_days, shared_slots, config, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      notes: row.notes,
      plan_days: Number(row.plan_days) || asDays(row.days).length || 7,
      days: asDays(row.days),
      partner_days: row.partner_days ? asDays(row.partner_days) : null,
      shared_slots: (row.shared_slots as Record<string, boolean> | null) ?? null,
      config: (row.config as NutritionPlanTemplateConfig | null) ?? null,
      updated_at: row.updated_at,
    }));
  });

/**
 * Speichert die aktuelle Wochenstruktur als Vorlage. Mit `id` wird eine
 * bestehende Vorlage überschrieben, sonst eine neue angelegt.
 */
export const saveNutritionPlanTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      title: string;
      notes?: string | null;
      days: BuilderDay[];
      partnerDays?: BuilderDay[] | null;
      sharedSlots?: Record<string, boolean> | null;
      config?: NutritionPlanTemplateConfig | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const title = data.title.trim();
    if (!title) throw new Error("Bitte einen Namen für die Vorlage angeben.");
    if (!Array.isArray(data.days) || data.days.length === 0) {
      throw new Error("Die Vorlage enthält keine Tage.");
    }

    const payload = {
      coach_id: context.userId,
      title,
      notes: data.notes?.trim() || null,
      plan_days: data.days.length,
      days: data.days as unknown as never,
      partner_days: (data.partnerDays ?? null) as unknown as never,
      shared_slots: (data.sharedSlots ?? null) as unknown as never,
      config: (data.config ?? null) as unknown as never,
    };

    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("nutrition_plan_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("coach_id", context.userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Vorlage nicht gefunden.");
      return { ok: true, id: updated.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("nutrition_plan_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

export const deleteNutritionPlanTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("nutrition_plan_templates")
      .delete()
      .eq("id", data.id)
      .eq("coach_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

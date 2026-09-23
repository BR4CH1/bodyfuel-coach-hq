import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

export type TrainingPlanStatus =
  | "draft"
  | "approved"
  | "published"
  | "active"
  | "archived";

export type TrainingPlanSummary = {
  id: string;
  title: string;
  status: TrainingPlanStatus;
  source: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  activated_at: string | null;
  archived_at: string | null;
  created_at: string;
  days_count: number;
  exercises_count: number;
};

async function loadTrainingPlan(
  supabase: any,
  id: string,
): Promise<TrainingPlanSummary | null> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select(
      "id, client_id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;
  const { data: days } = await supabase
    .from("training_days")
    .select("id")
    .eq("plan_id", id);
  const dayIds = (days ?? []).map((d: any) => d.id);
  let exerciseCount = 0;
  if (dayIds.length) {
    const { count } = await supabase
      .from("training_exercises")
      .select("id", { count: "exact", head: true })
      .in("day_id", dayIds);
    exerciseCount = count ?? 0;
  }
  return {
    ...(plan as any),
    days_count: dayIds.length,
    exercises_count: exerciseCount,
  };
}

export const getCustomerTrainingPlanOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let db = supabase;
    if (data.user_id !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "training");
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }

    const { data: rows } = await db
      .from("nutrition_plans")
      .select(
        "id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, created_at",
      )
      .eq("client_id", data.user_id)
      .eq("plan_type", "training")
      .order("created_at", { ascending: false });

    const all = (rows ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ??
      null;
    const archive = all.filter((p) => p.status === "archived").slice(0, 25);

    const [activeFull, nextFull] = await Promise.all([
      active ? loadTrainingPlan(db, active.id) : Promise.resolve(null),
      next ? loadTrainingPlan(db, next.id) : Promise.resolve(null),
    ]);

    const { data: prof } = await db
      .from("smart_nutrition_profile")
      .select("auto_publish_training, training_weekdays")
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      active: activeFull,
      next: nextFull,
      archive,
      auto_publish: (prof as any)?.auto_publish_training ?? false,
      training_weekdays: (prof as any)?.training_weekdays ?? [],
    };
  });

export const transitionTrainingPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { plan_id: string; to: TrainingPlanStatus }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, plan_type, status")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || (plan as any).plan_type !== "training")
      throw new Error("Trainingsplan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");

    if (data.to === "active") {
      await supabaseAdmin
        .from("nutrition_plans")
        .update({ status: "archived" })
        .eq("client_id", (plan as any).client_id)
        .eq("plan_type", "training")
        .eq("status", "active")
        .neq("id", data.plan_id);
    }

    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .update({ status: data.to })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.to };
  });

export const deleteTrainingPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("client_id, status, plan_type")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");
    if ((plan as any).status === "active")
      throw new Error("Aktiver Plan kann nicht gelöscht werden — erst archivieren.");
    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .delete()
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTrainingPlanScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      plan_id: string;
      scheduled_start_date?: string | null;
      scheduled_end_date?: string | null;
      title?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("client_id, plan_type")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || (plan as any).plan_type !== "training") throw new Error("Trainingsplan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");
    const patch: any = {};
    if (data.scheduled_start_date !== undefined)
      patch.scheduled_start_date = data.scheduled_start_date;
    if (data.scheduled_end_date !== undefined)
      patch.scheduled_end_date = data.scheduled_end_date;
    if (data.title !== undefined) patch.title = data.title;
    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .update(patch)
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Zentrale, manuelle Verlängerung eines bestehenden Trainingsplans.
 * Kopiert das bestehende Wochenmuster inkl. aller Übungsattribute in die neuen
 * Wochen, aktualisiert Zeitraum + weeks_count, validiert das Ergebnis und rollt
 * bei Inkonsistenz alles zurück. Idempotent: vorhandene Wochen werden nie
 * doppelt erzeugt.
 */
export const extendTrainingPlanWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { plan_id: string; add_weeks: number; target_weeks?: number }) => d,
  )
  .handler(async ({ data, context }) => {
    const { buildExtensionBlueprint } = await import("@/lib/training-plan-extension.logic");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, plan_type, weeks_count, scheduled_start_date, scheduled_end_date")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || (plan as any).plan_type !== "training")
      throw new Error("Trainingsplan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");

    const { data: dayRows, error: dayErr } = await supabaseAdmin
      .from("training_days")
      .select("id, name, week_number, sort_order, day_date")
      .eq("plan_id", data.plan_id)
      .order("sort_order");
    if (dayErr) throw new Error(dayErr.message);

    const existingDays = (dayRows ?? []) as any[];
    const blueprint = buildExtensionBlueprint({
      existingDays: existingDays.map((d) => ({
        id: d.id,
        name: d.name ?? "",
        week_number: Number(d.week_number ?? 1),
        sort_order: Number(d.sort_order ?? 0),
        day_date: d.day_date ?? null,
      })),
      addWeeks: data.add_weeks,
      // Ziel-Laufzeit macht Wiederholungen derselben Aktion wirkungslos.
      targetWeeks: data.target_weeks,
    });

    if (!blueprint.days.length) {
      return {
        ok: true as const,
        added_days: 0,
        added_exercises: 0,
        weeks_count: blueprint.targetWeeks,
        end_date: blueprint.endDate,
        already_extended: true as const,
      };
    }

    const sourceIds = Array.from(new Set(blueprint.days.map((d) => d.source_day_id)));
    const { data: exRows, error: exErr } = await supabaseAdmin
      .from("training_exercises")
      .select("*")
      .in("day_id", sourceIds)
      .order("sort_order");
    if (exErr) throw new Error(exErr.message);

    const bySource = new Map<string, any[]>();
    for (const ex of (exRows ?? []) as any[]) {
      const arr = bySource.get(ex.day_id) ?? [];
      arr.push(ex);
      bySource.set(ex.day_id, arr);
    }

    const insertedDayIds: string[] = [];
    let addedExercises = 0;

    const rollback = async () => {
      if (!insertedDayIds.length) return;
      await supabaseAdmin.from("training_exercises").delete().in("day_id", insertedDayIds);
      await supabaseAdmin.from("training_days").delete().in("id", insertedDayIds);
    };

    try {
      for (const target of blueprint.days) {
        const { data: newDay, error: insErr } = await supabaseAdmin
          .from("training_days")
          .insert({
            plan_id: data.plan_id,
            name: (target.name || "Trainingstag").slice(0, 120),
            sort_order: target.sort_order,
            week_number: target.week_number,
            day_date: target.day_date,
          } as any)
          .select("id")
          .single();
        if (insErr || !newDay) throw new Error(insErr?.message ?? "Tag konnte nicht angelegt werden");
        insertedDayIds.push(newDay.id as string);

        const src = bySource.get(target.source_day_id) ?? [];
        if (!src.length) continue; // Ruhetag bleibt Ruhetag
        const rows = src.map((ex: any, idx: number) => ({
          day_id: newDay.id,
          name: ex.name,
          category: ex.category ?? null,
          target_sets: ex.target_sets ?? null,
          target_reps: ex.target_reps ?? null,
          target_weights: ex.target_weights ?? null,
          target_rir: ex.target_rir ?? null,
          rest_seconds: ex.rest_seconds ?? null,
          notes: ex.notes ?? null,
          is_locked: !!ex.is_locked,
          smart_lock: ex.smart_lock ?? "none",
          linked_partner_group: ex.linked_partner_group ?? null,
          library_exercise_id: ex.library_exercise_id ?? null,
          set_type: ex.set_type ?? "normal",
          sort_order: Number(ex.sort_order ?? idx),
        }));
        const { error: exInsErr } = await supabaseAdmin
          .from("training_exercises")
          .insert(rows as any);
        if (exInsErr) throw new Error(exInsErr.message);
        addedExercises += rows.length;
      }

      // Validierung: jeder neue Tag muss die Übungsstruktur seines Quelltags haben.
      const { data: checkRows, error: checkErr } = await supabaseAdmin
        .from("training_exercises")
        .select("day_id, name, sort_order, target_sets, target_reps")
        .in("day_id", insertedDayIds)
        .order("sort_order");
      if (checkErr) throw new Error(checkErr.message);
      const byNew = new Map<string, any[]>();
      for (const ex of (checkRows ?? []) as any[]) {
        const arr = byNew.get(ex.day_id) ?? [];
        arr.push(ex);
        byNew.set(ex.day_id, arr);
      }
      blueprint.days.forEach((target, i) => {
        const newId = insertedDayIds[i];
        const expected = (bySource.get(target.source_day_id) ?? [])
          .slice()
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
        const actual = (byNew.get(newId) ?? [])
          .slice()
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
        if (expected.length !== actual.length) {
          throw new Error(
            `Verlängerung inkonsistent: Woche ${target.week_number} — ${target.name} hat ${actual.length} statt ${expected.length} Übungen.`,
          );
        }
        for (let j = 0; j < expected.length; j++) {
          if ((expected[j].name ?? "") !== (actual[j].name ?? "")) {
            throw new Error(
              `Verlängerung inkonsistent: Übung "${expected[j].name}" fehlt in Woche ${target.week_number}.`,
            );
          }
        }
      });

      const endDate = blueprint.endDate ?? (plan as any).scheduled_end_date ?? null;
      const { error: planUpdErr } = await supabaseAdmin
        .from("nutrition_plans")
        .update({
          weeks_count: blueprint.targetWeeks,
          scheduled_end_date: endDate,
        } as any)
        .eq("id", data.plan_id);
      if (planUpdErr) throw new Error(planUpdErr.message);

      return {
        ok: true as const,
        added_days: insertedDayIds.length,
        added_exercises: addedExercises,
        weeks_count: blueprint.targetWeeks,
        end_date: endDate,
        already_extended: false as const,
      };
    } catch (error) {
      await rollback();
      throw error instanceof Error ? error : new Error("Verlängerung fehlgeschlagen");
    }
  });

export const setAutoPublishTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; auto_publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = data.user_id === userId
      ? supabase
      : (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    if (data.user_id !== userId) await assertCoachOrOrgStaffForAthlete(context, data.user_id, "training");
    const { error } = await db
      .from("smart_nutrition_profile")
      .upsert(
        { user_id: data.user_id, auto_publish_training: data.auto_publish },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

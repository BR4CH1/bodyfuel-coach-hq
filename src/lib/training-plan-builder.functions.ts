import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertCoachOrOrgStaffForAthlete,
  assertGlobalCoachOrAnyOrgCoach,
} from "@/lib/organizations/org-coach-access";

// 0=Sun..6=Sat
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  so: 0,
  sonntag: 0,
  "0": 0,
  "7": 0,
  monday: 1,
  mon: 1,
  mo: 1,
  montag: 1,
  "1": 1,
  tuesday: 2,
  tue: 2,
  di: 2,
  dienstag: 2,
  "2": 2,
  wednesday: 3,
  wed: 3,
  mi: 3,
  mittwoch: 3,
  "3": 3,
  thursday: 4,
  thu: 4,
  do: 4,
  donnerstag: 4,
  "4": 4,
  friday: 5,
  fri: 5,
  fr: 5,
  freitag: 5,
  "5": 5,
  saturday: 6,
  sat: 6,
  sa: 6,
  samstag: 6,
  "6": 6,
};
function normalizeWeekdays(v: any): number[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const raw of v) {
    if (raw == null) continue;
    const key = String(raw).trim().toLowerCase();
    if (key in WEEKDAY_MAP) out.add(WEEKDAY_MAP[key]);
  }
  return Array.from(out);
}

export type LibraryExercise = {
  id: string;
  name: string;
  category: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string[];
  movement_pattern: string;
  is_unilateral: boolean;
  difficulty: string;
  default_sets: number;
  default_reps: string;
  default_rest_seconds: number;
  notes: string | null;
  is_active: boolean;
  /** Medienmodell (optional, rückwärtskompatibel) */
  thumbnail_url?: string | null;
  animation_url?: string | null;
  media_type?: string | null;
  media_source?: string | null;
  technique_hint?: string | null;
};


export type StrengthBaseline = {
  bench_press_kg: number | null;
  shoulder_press_kg: number | null;
  squat_kg: number | null;
  deadlift_kg: number | null;
  lat_pulldown_kg: number | null;
  row_kg: number | null;
  leg_press_kg: number | null;
  leg_curl_kg: number | null;
};

export type CustomerTrainingContext = {
  displayName: string | null;
  trainingWeekdays: number[]; // 0=Sun..6=Sat
  experienceLevel: string | null;
  mainGoal: string | null;
  bodyweightKg: number | null;
  baseline: StrengthBaseline;
  hasPartner: boolean;
  partnerId: string | null;
  partnerName: string | null;
};

export const listExerciseLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LibraryExercise[]> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("coach_exercise_library" as any)
      .select("*")
      .eq("is_active", true)
      .order("movement_pattern")
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as LibraryExercise[];
  });

export const getCustomerTrainingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customerId: string }) => d)
  .handler(async ({ data, context }): Promise<CustomerTrainingContext> => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "training");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = data.customerId;
    const [{ data: prof }, { data: snp }, { data: bm }, { data: check }, { data: partnerRows }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("display_name, training_goal")
          .eq("id", cid)
          .maybeSingle(),
        supabaseAdmin
          .from("smart_nutrition_profile")
          .select("training_weekdays")
          .eq("user_id", cid)
          .maybeSingle(),
        supabaseAdmin
          .from("body_measurements")
          .select("weight_kg, measured_at")
          .eq("user_id", cid)
          .not("weight_kg", "is", null)
          .order("measured_at", { ascending: false })
          .limit(1),
        supabaseAdmin
          .from("strength_checks")
          .select("id, exercise_calcs, scoring_bodyweight_kg")
          .eq("user_id", cid)
          .eq("status", "completed")
          .order("performed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("nutrition_partners")
          .select("user_a, user_b")
          .or(`user_a.eq.${cid},user_b.eq.${cid}`)
          .limit(1),
      ]);

    let partnerId: string | null = null;
    if (partnerRows && partnerRows.length) {
      const r = partnerRows[0] as any;
      partnerId = r.user_a === cid ? r.user_b : r.user_a;
    }
    let partnerName: string | null = null;
    if (partnerId) {
      const { data: pp } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", partnerId)
        .maybeSingle();
      partnerName = pp?.display_name ?? null;
    }

    // Baseline from strength_check exercise_calcs.adjustedE1RM × 0.75, rounded to 2.5kg.
    const baseline: StrengthBaseline = {
      bench_press_kg: null,
      shoulder_press_kg: null,
      squat_kg: null,
      deadlift_kg: null,
      lat_pulldown_kg: null,
      row_kg: null,
      leg_press_kg: null,
      leg_curl_kg: null,
    };
    const calcs = (check?.exercise_calcs as any) ?? null;
    if (calcs && typeof calcs === "object") {
      const roundTo25 = (n: number) => Math.max(2.5, Math.round(n / 2.5) * 2.5);
      const derive = (raw: any) => {
        if (!raw) return null;
        const e1rm = Number(raw.adjustedE1RM ?? raw.adjusted_e1rm ?? 0);
        if (!Number.isFinite(e1rm) || e1rm <= 0) return null;
        return roundTo25(e1rm * 0.75);
      };
      for (const [k, v] of Object.entries(calcs)) {
        const key = k.toLowerCase();
        if (/(bench|brustpresse|chest_press)/.test(key)) baseline.bench_press_kg ??= derive(v);
        else if (/(shoulder|overhead|schulterpresse)/.test(key))
          baseline.shoulder_press_kg ??= derive(v);
        else if (/(squat|kniebeuge)/.test(key)) baseline.squat_kg ??= derive(v);
        else if (/(deadlift|kreuzheb)/.test(key)) baseline.deadlift_kg ??= derive(v);
        else if (/(lat|pulldown|latzug)/.test(key)) baseline.lat_pulldown_kg ??= derive(v);
        else if (/(row|rudern)/.test(key)) baseline.row_kg ??= derive(v);
        else if (/(leg_press|beinpresse)/.test(key)) baseline.leg_press_kg ??= derive(v);
        else if (/(leg_curl|beinbeuger)/.test(key)) baseline.leg_curl_kg ??= derive(v);
      }
    }

    return {
      displayName: prof?.display_name ?? null,
      trainingWeekdays: normalizeWeekdays((snp as any)?.training_weekdays),
      experienceLevel: null,
      mainGoal: (prof as any)?.training_goal ?? null,
      bodyweightKg:
        (check as any)?.scoring_bodyweight_kg ??
        (bm && bm.length ? Number((bm[0] as any).weight_kg) : null),
      baseline,
      hasPartner: !!partnerId,
      partnerId,
      partnerName,
    };
  });

// -------- Save --------

export type BuilderSmartLock = "none" | "locked" | "weight_only" | "reps_only" | "volume_only";

export type BuilderTrainingExercise = {
  library_exercise_id?: string | null;
  name: string;
  category?: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_weights: string | null;
  target_rir: number | null;
  rest_seconds: number | null;
  notes: string | null;
  is_locked?: boolean;
  smart_lock?: BuilderSmartLock;
  linked_partner_group?: string | null;
};

export type BuilderTrainingDay = {
  week_number: number; // 1..N
  weekday: number; // 0=Sun..6=Sat
  name: string;
  type: "training" | "rest";
  exercises: BuilderTrainingExercise[];
};

const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export async function persistTrainingPlan(data: {
  customerId: string;
  uploadedBy: string;
  title: string;
  startDate: string; // ISO yyyy-mm-dd, week1 monday
  weeksCount: number;
  days: BuilderTrainingDay[];
  publish?: boolean;
  sourceTemplateId?: string | null;
  sourceTemplateVersionId?: string | null;
}): Promise<{
  plan_id: string;
  day_ids: Record<string, string>;
  exercise_ids: Record<string, string>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const cleanTitle = data.title.trim();
  if (!cleanTitle) throw new Error("Bitte gib dem Trainingsplan einen Namen.");
  if (!Number.isInteger(data.weeksCount) || data.weeksCount < 1 || data.weeksCount > 12) {
    throw new Error("Die Laufzeit muss zwischen 1 und 12 Wochen liegen.");
  }
  if (
    data.publish &&
    !data.days.some((day) => day.type === "training" && day.exercises.length > 0)
  ) {
    throw new Error("Füge mindestens eine Übung hinzu, bevor du den Plan zuweist.");
  }
  if (
    data.publish &&
    data.days.some(
      (day) => day.type === "training" && day.exercises.some((exercise) => !exercise.name.trim()),
    )
  ) {
    throw new Error("Bitte gib jeder Übung einen Namen, bevor du den Plan zuweist.");
  }

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(data.startDate + "T00:00:00Z");
  if (Number.isNaN(start.getTime())) throw new Error("Das Startdatum ist ungültig.");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + data.weeksCount * 7 - 1);

  type PreviousPlanState = {
    id: string;
    status: "draft" | "approved" | "published" | "active" | "archived";
    activated_at: string | null;
    archived_at: string | null;
  };

  // The schema allows exactly one pending and one active plan per customer.
  // Capture both before swapping so a failed save can restore the prior state.
  const { data: previousRows, error: previousRowsError } = await supabaseAdmin
    .from("nutrition_plans")
    .select("id, status, activated_at, archived_at, created_at")
    .eq("client_id", data.customerId)
    .eq("plan_type", "training")
    .in("status", ["draft", "approved", "published", "active"])
    .order("created_at", { ascending: false });
  if (previousRowsError) throw previousRowsError;

  const previousPlans = (previousRows ?? []) as PreviousPlanState[];
  const previousPending = previousPlans.find((plan) =>
    ["draft", "approved", "published"].includes(plan.status),
  );
  const previousActive = previousPlans.find((plan) => plan.status === "active");
  let pendingWasArchived = false;
  let activeWasArchived = false;
  let planId: string | null = null;
  const dayIds: Record<string, string> = {};
  const exerciseIds: Record<string, string> = {};

  // Group by (week, weekday); ensure exactly 7 days per week
  const byKey = new Map<string, BuilderTrainingDay>();
  for (const d of data.days) byKey.set(`${d.week_number}:${d.weekday}`, d);

  try {
    // Free the unique "pending plan" slot before inserting the replacement.
    // The old pending plan is restored below if any later step fails.
    if (previousPending) {
      const { error: archivePendingError } = await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: "archived",
          is_active: false,
          archived_at: new Date().toISOString(),
        } as any)
        .eq("id", previousPending.id);
      if (archivePendingError) throw archivePendingError;
      pendingWasArchived = true;
    }

    // Build the replacement as an inactive draft. The active customer plan
    // remains untouched until every day and exercise has been persisted.
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("nutrition_plans")
      .insert({
        client_id: data.customerId,
        title: cleanTitle,
        plan_type: "training",
        is_active: false,
        status: "draft",
        generated_by: "coach_manual",
        source: "manual",
        uploaded_by: data.uploadedBy,
        file_path: `${data.customerId}/coach-manual/training-${Date.now()}.json`,
        file_name: "coach-training.json",
        scheduled_start_date: isoDate(start),
        scheduled_end_date: isoDate(end),
        weeks_count: data.weeksCount,
        source_template_id: data.sourceTemplateId ?? null,
        source_template_version_id: data.sourceTemplateVersionId ?? null,
      } as any)
      .select("id")
      .single();
    if (planErr || !planRow) {
      throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");
    }
    planId = planRow.id as string;

    let sortIdx = 0;
    for (let w = 1; w <= data.weeksCount; w++) {
      // sort_order runs Mo..So (weekday order 1,2,3,4,5,6,0)
      const order = [1, 2, 3, 4, 5, 6, 0];
      for (const wd of order) {
        const key = `${w}:${wd}`;
        const src = byKey.get(key);
        const isTraining = src?.type === "training";
        const label = isTraining
          ? src!.name || `${WD_SHORT[wd]} — Training`
          : `${WD_SHORT[wd]} — Ruhetag`;

        const dayDate = new Date(start);
        dayDate.setUTCDate(dayDate.getUTCDate() + (w - 1) * 7 + order.indexOf(wd));

        const { data: dayRow, error: dayErr } = await supabaseAdmin
          .from("training_days")
          .insert({
            plan_id: planId,
            name: label.slice(0, 120),
            sort_order: sortIdx++,
            week_number: w,
            day_date: isoDate(dayDate),
          } as any)
          .select("id")
          .single();
        if (dayErr || !dayRow) {
          throw new Error(dayErr?.message ?? `${label} konnte nicht gespeichert werden.`);
        }
        dayIds[key] = dayRow.id;

        if (!isTraining || !src?.exercises?.length) continue;

        for (let i = 0; i < src.exercises.length; i++) {
          const ex = src.exercises[i];
          const targetSets =
            ex.target_sets == null
              ? null
              : Math.max(1, Math.min(20, Math.round(Number(ex.target_sets))));
          const targetRir =
            ex.target_rir == null
              ? null
              : Math.max(0, Math.min(10, Math.round(Number(ex.target_rir))));
          const restSeconds =
            ex.rest_seconds == null
              ? null
              : Math.max(0, Math.min(600, Math.round(Number(ex.rest_seconds))));
          const { data: exRow, error: exErr } = await supabaseAdmin
            .from("training_exercises")
            .insert({
              day_id: dayRow.id,
              name: (ex.name || "").trim().slice(0, 200),
              category: ex.category ?? null,
              target_sets: targetSets,
              target_reps: ex.target_reps ?? null,
              target_weights: ex.target_weights ?? null,
              target_rir: targetRir,
              rest_seconds: restSeconds,
              notes: ex.notes ?? null,
              is_locked: !!ex.is_locked,
              smart_lock: (ex.smart_lock ?? "none") as any,
              linked_partner_group: ex.linked_partner_group ?? null,
              library_exercise_id: ex.library_exercise_id ?? null,
              sort_order: i,
            } as any)
            .select("id")
            .single();
          if (exErr || !exRow) {
            throw new Error(
              exErr?.message ?? `${ex.name || "Übung"} konnte nicht gespeichert werden.`,
            );
          }
          exerciseIds[`${key}:${i}`] = exRow.id;
        }
      }
    }

    if (data.publish) {
      const activatedAt = new Date().toISOString();
      // The partial unique index permits only one active plan. Archive the
      // previous active plan first, then activate the fully-built replacement.
      if (previousActive) {
        const { error: archiveActiveError } = await supabaseAdmin
          .from("nutrition_plans")
          .update({ status: "archived", is_active: false, archived_at: activatedAt } as any)
          .eq("id", previousActive.id);
        if (archiveActiveError) throw archiveActiveError;
        activeWasArchived = true;
      }

      const { error: activateErr } = await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: "active",
          is_active: true,
          activated_at: activatedAt,
          archived_at: null,
        } as any)
        .eq("id", planId);
      if (activateErr) throw activateErr;
    }
  } catch (error) {
    // Archive/delete the incomplete replacement first so the unique pending or
    // active slot is free before restoring the customer's prior plans.
    if (planId) {
      await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: "archived",
          is_active: false,
          archived_at: new Date().toISOString(),
        } as any)
        .eq("id", planId);
      // training_days/training_exercises cascade with the plan.
      await supabaseAdmin.from("nutrition_plans").delete().eq("id", planId);
    }
    if (activeWasArchived && previousActive) {
      await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: "active",
          is_active: true,
          activated_at: previousActive.activated_at,
          archived_at: previousActive.archived_at,
        } as any)
        .eq("id", previousActive.id);
    }
    if (pendingWasArchived && previousPending) {
      await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: previousPending.status,
          is_active: false,
          activated_at: previousPending.activated_at,
          archived_at: previousPending.archived_at,
        } as any)
        .eq("id", previousPending.id);
    }
    throw error;
  }

  if (!planId) throw new Error("Plan konnte nicht angelegt werden");
  return { plan_id: planId, day_ids: dayIds, exercise_ids: exerciseIds };
}

export const saveBuilderTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerId: string;
      title: string;
      startDate: string;
      weeksCount: number;
      days: BuilderTrainingDay[];
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "training");
    const res = await persistTrainingPlan({ ...data, uploadedBy: context.userId });
    return { ok: true, plan_id: res.plan_id };
  });

export const saveBuilderPartnerTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerId: string;
      partnerId: string;
      title: string;
      startDate: string;
      weeksCount: number;
      clientDays: BuilderTrainingDay[];
      partnerDays: BuilderTrainingDay[];
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.customerId, "training");
    await assertCoachOrOrgStaffForAthlete(context, data.partnerId, "training");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build and link both plans as drafts first. Publishing only happens after
    // both sides exist, so neither customer can receive half a partner plan.
    const A = await persistTrainingPlan({
      customerId: data.customerId,
      uploadedBy: context.userId,
      title: data.title,
      startDate: data.startDate,
      weeksCount: data.weeksCount,
      days: data.clientDays,
      publish: false,
    });
    const B = await persistTrainingPlan({
      customerId: data.partnerId,
      uploadedBy: context.userId,
      title: data.title,
      startDate: data.startDate,
      weeksCount: data.weeksCount,
      days: data.partnerDays,
      publish: false,
    });

    const { error: linkPlanAError } = await supabaseAdmin
      .from("nutrition_plans")
      .update({ is_partner_plan: true, partner_plan_id: B.plan_id } as any)
      .eq("id", A.plan_id);
    if (linkPlanAError) throw linkPlanAError;
    const { error: linkPlanBError } = await supabaseAdmin
      .from("nutrition_plans")
      .update({ is_partner_plan: true, partner_plan_id: A.plan_id } as any)
      .eq("id", B.plan_id);
    if (linkPlanBError) throw linkPlanBError;

    // Cross-link exercises by linked_partner_group
    // A: iterate client days
    const idxA = new Map<string, string>(); // group -> exercise_id
    const idxB = new Map<string, string>();
    for (const d of data.clientDays) {
      const key = `${d.week_number}:${d.weekday}`;
      d.exercises?.forEach((ex, i) => {
        if (ex.linked_partner_group) {
          const id = A.exercise_ids[`${key}:${i}`];
          if (id) idxA.set(`${key}:${ex.linked_partner_group}`, id);
        }
      });
    }
    for (const d of data.partnerDays) {
      const key = `${d.week_number}:${d.weekday}`;
      d.exercises?.forEach((ex, i) => {
        if (ex.linked_partner_group) {
          const id = B.exercise_ids[`${key}:${i}`];
          if (id) idxB.set(`${key}:${ex.linked_partner_group}`, id);
        }
      });
    }
    for (const [k, aid] of idxA) {
      const bid = idxB.get(k);
      if (!bid) continue;
      const { error: linkExerciseAError } = await supabaseAdmin
        .from("training_exercises")
        .update({ partner_exercise_id: bid } as any)
        .eq("id", aid);
      if (linkExerciseAError) throw linkExerciseAError;
      const { error: linkExerciseBError } = await supabaseAdmin
        .from("training_exercises")
        .update({ partner_exercise_id: aid } as any)
        .eq("id", bid);
      if (linkExerciseBError) throw linkExerciseBError;
    }

    if (data.publish) {
      const newPlanIds = [A.plan_id, B.plan_id];
      const customerIds = [data.customerId, data.partnerId];
      const { data: previousActiveRows, error: previousActiveError } = await supabaseAdmin
        .from("nutrition_plans")
        .select("id")
        .in("client_id", customerIds)
        .eq("plan_type", "training")
        .eq("status", "active");
      if (previousActiveError) throw previousActiveError;
      const previousActiveIds = ((previousActiveRows ?? []) as Array<{ id: string }>).map(
        (plan) => plan.id,
      );
      const activatedAt = new Date().toISOString();

      if (previousActiveIds.length) {
        const { error: archiveActiveError } = await supabaseAdmin
          .from("nutrition_plans")
          .update({
            status: "archived",
            is_active: false,
            archived_at: activatedAt,
          } as any)
          .in("id", previousActiveIds);
        if (archiveActiveError) throw archiveActiveError;
      }

      const { error: activatePartnerPlansError } = await supabaseAdmin
        .from("nutrition_plans")
        .update({
          status: "active",
          is_active: true,
          activated_at: activatedAt,
          archived_at: null,
        } as any)
        .in("id", newPlanIds);

      if (activatePartnerPlansError) {
        // Keep the completed replacements as drafts and put both customers
        // back on their previous active plans.
        await supabaseAdmin
          .from("nutrition_plans")
          .update({
            status: "draft",
            is_active: false,
            activated_at: null,
            archived_at: null,
          } as any)
          .in("id", newPlanIds);
        if (previousActiveIds.length) {
          await supabaseAdmin
            .from("nutrition_plans")
            .update({ status: "active", is_active: true, archived_at: null } as any)
            .in("id", previousActiveIds);
        }
        throw activatePartnerPlansError;
      }
    }

    return { ok: true, client_plan_id: A.plan_id, partner_plan_id: B.plan_id };
  });

// -------- Load existing training plan for editing --------

export type LoadedTrainingPlan = {
  plan_id: string;
  title: string;
  startDate: string; // ISO Monday
  weeksCount: number;
  days: BuilderTrainingDay[];
};

export const loadTrainingPlanForBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<LoadedTrainingPlan> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error: pErr } = await supabaseAdmin
      .from("nutrition_plans")
      .select(
        "id, client_id, title, scheduled_start_date, scheduled_end_date, weeks_count, plan_type",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (pErr || !plan) throw new Error(pErr?.message ?? "Plan nicht gefunden");
    if ((plan as any).plan_type !== "training") throw new Error("Kein Trainingsplan");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");

    const { data: dayRows } = await supabaseAdmin
      .from("training_days")
      .select("id, sort_order, name, week_number, day_date")
      .eq("plan_id", data.planId)
      .order("sort_order");

    const dayIds = ((dayRows ?? []) as any[]).map((r) => r.id);
    const exRes = dayIds.length
      ? await supabaseAdmin
          .from("training_exercises")
          .select(
            "id, day_id, sort_order, name, category, target_sets, target_reps, target_weights, target_rir, rest_seconds, notes, is_locked, smart_lock, linked_partner_group, library_exercise_id",
          )
          .in("day_id", dayIds)
          .order("sort_order")
      : ({ data: [] as any[] } as any);

    const byDay = new Map<string, any[]>();
    for (const ex of (exRes.data ?? []) as any[]) {
      const arr = byDay.get(ex.day_id) ?? [];
      arr.push(ex);
      byDay.set(ex.day_id, arr);
    }

    const startIso = (plan as any).scheduled_start_date ?? new Date().toISOString().slice(0, 10);
    const weeksCount = Math.max(1, Number((plan as any).weeks_count ?? 1));

    // Determine weekday from day_date; fall back to Mo..So sort_order
    const days: BuilderTrainingDay[] = ((dayRows ?? []) as any[]).map((d, idx) => {
      let weekday = 1;
      if (d.day_date) {
        weekday = new Date(d.day_date + "T00:00:00Z").getUTCDay();
      } else {
        // sort_order runs Mo..So repeatedly: 0->Mo(1),1->Di(2),...,5->Sa(6),6->So(0)
        const order = [1, 2, 3, 4, 5, 6, 0];
        weekday = order[idx % 7];
      }
      const exs = (byDay.get(d.id) ?? []).map((ex: any): BuilderTrainingExercise => ({
        library_exercise_id: ex.library_exercise_id ?? null,
        name: ex.name ?? "",
        category: ex.category ?? null,
        target_sets: ex.target_sets ?? null,
        target_reps: ex.target_reps ?? null,
        target_weights: ex.target_weights ?? null,
        target_rir: ex.target_rir ?? null,
        rest_seconds: ex.rest_seconds ?? null,
        notes: ex.notes ?? null,
        is_locked: !!ex.is_locked,
        smart_lock: (ex.smart_lock ?? "none") as BuilderSmartLock,
        linked_partner_group: ex.linked_partner_group ?? null,
      }));
      const isRest = /ruhetag|rest/i.test(d.name ?? "") || exs.length === 0;
      return {
        week_number: Math.max(1, Number(d.week_number ?? Math.floor(idx / 7) + 1)),
        weekday,
        name: d.name ?? "",
        type: isRest ? "rest" : "training",
        exercises: exs,
      };
    });

    return {
      plan_id: (plan as any).id,
      title: (plan as any).title ?? "Trainingsplan",
      startDate: startIso,
      weeksCount,
      days,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { data: isCoach } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Nur für Coaches.");
}

// 0=Sun..6=Sat
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, so: 0, sonntag: 0, "0": 0, "7": 0,
  monday: 1, mon: 1, mo: 1, montag: 1, "1": 1,
  tuesday: 2, tue: 2, di: 2, dienstag: 2, "2": 2,
  wednesday: 3, wed: 3, mi: 3, mittwoch: 3, "3": 3,
  thursday: 4, thu: 4, do: 4, donnerstag: 4, "4": 4,
  friday: 5, fri: 5, fr: 5, freitag: 5, "5": 5,
  saturday: 6, sat: 6, sa: 6, samstag: 6, "6": 6,
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
    await assertCoach(context);
    const { data, error } = await context.supabase
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
    await assertCoach(context);
    const cid = data.customerId;
    const [{ data: prof }, { data: snp }, { data: bm }, { data: check }, { data: partnerRows }] =
      await Promise.all([
        context.supabase.from("profiles").select("display_name, training_goal").eq("id", cid).maybeSingle(),
        context.supabase.from("smart_nutrition_profile").select("training_weekdays, experience_level").eq("user_id", cid).maybeSingle(),
        context.supabase.from("body_measurements").select("weight_kg, measured_at").eq("user_id", cid).not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1),
        context.supabase.from("strength_checks").select("id, exercise_calcs, scoring_bodyweight_kg").eq("user_id", cid).eq("status", "completed").order("performed_at", { ascending: false }).limit(1).maybeSingle(),
        context.supabase.from("nutrition_partners").select("user_a, user_b").or(`user_a.eq.${cid},user_b.eq.${cid}`).limit(1),
      ]);

    let partnerId: string | null = null;
    if (partnerRows && partnerRows.length) {
      const r = partnerRows[0] as any;
      partnerId = r.user_a === cid ? r.user_b : r.user_a;
    }
    let partnerName: string | null = null;
    if (partnerId) {
      const { data: pp } = await context.supabase.from("profiles").select("display_name").eq("id", partnerId).maybeSingle();
      partnerName = pp?.display_name ?? null;
    }

    // Baseline from strength_check exercise_calcs.adjustedE1RM × 0.75, rounded to 2.5kg.
    const baseline: StrengthBaseline = {
      bench_press_kg: null, shoulder_press_kg: null, squat_kg: null, deadlift_kg: null,
      lat_pulldown_kg: null, row_kg: null, leg_press_kg: null, leg_curl_kg: null,
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
        else if (/(shoulder|overhead|schulterpresse)/.test(key)) baseline.shoulder_press_kg ??= derive(v);
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
      experienceLevel: (snp as any)?.experience_level ?? null,
      mainGoal: (prof as any)?.training_goal ?? null,
      bodyweightKg: (check as any)?.scoring_bodyweight_kg ?? (bm && bm.length ? Number((bm[0] as any).weight_kg) : null),
      baseline,
      hasPartner: !!partnerId,
      partnerId,
      partnerName,
    };
  });

// -------- Save --------

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
  linked_partner_group?: string | null;
};

export type BuilderTrainingDay = {
  week_number: number; // 1..N
  weekday: number;     // 0=Sun..6=Sat
  name: string;
  type: "training" | "rest";
  exercises: BuilderTrainingExercise[];
};

const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

async function persistTrainingPlan(
  data: {
    customerId: string;
    uploadedBy: string;
    title: string;
    startDate: string; // ISO yyyy-mm-dd, week1 monday
    weeksCount: number;
    days: BuilderTrainingDay[];
    publish?: boolean;
  },
): Promise<{ plan_id: string; day_ids: Record<string, string>; exercise_ids: Record<string, string> }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Archive prior training drafts/active plans
  await supabaseAdmin
    .from("nutrition_plans")
    .update({ status: "archived" } as any)
    .eq("client_id", data.customerId)
    .eq("plan_type", "training")
    .in("status", ["draft", "approved", "published", "active"]);

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(data.startDate + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + data.weeksCount * 7 - 1);

  const { data: planRow, error: planErr } = await supabaseAdmin
    .from("nutrition_plans")
    .insert({
      client_id: data.customerId,
      title: data.title,
      plan_type: "training",
      is_active: false,
      status: data.publish ? "active" : "draft",
      generated_by: "coach_manual",
      source: "coach_manual",
      uploaded_by: data.uploadedBy,
      file_path: `coach-manual/${data.customerId}/training-${Date.now()}.json`,
      file_name: "coach-training.json",
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
      weeks_count: data.weeksCount,
    } as any)
    .select("id")
    .single();
  if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

  const planId = planRow.id as string;
  const dayIds: Record<string, string> = {};
  const exerciseIds: Record<string, string> = {};

  // Group by (week, weekday); ensure exactly 7 days per week
  const byKey = new Map<string, BuilderTrainingDay>();
  for (const d of data.days) byKey.set(`${d.week_number}:${d.weekday}`, d);

  let sortIdx = 0;
  for (let w = 1; w <= data.weeksCount; w++) {
    // sort_order runs Mo..So (weekday order 1,2,3,4,5,6,0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    for (const wd of order) {
      const key = `${w}:${wd}`;
      const src = byKey.get(key);
      const isTraining = src?.type === "training";
      const label = isTraining ? (src!.name || `${WD_SHORT[wd]} — Training`) : `${WD_SHORT[wd]} — Ruhetag`;

      // Compute day_date
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
      if (dayErr || !dayRow) continue;
      dayIds[key] = dayRow.id;

      if (!isTraining || !src?.exercises?.length) continue;

      for (let i = 0; i < src.exercises.length; i++) {
        const ex = src.exercises[i];
        const { data: exRow } = await supabaseAdmin
          .from("training_exercises")
          .insert({
            day_id: dayRow.id,
            name: (ex.name || "").slice(0, 200),
            category: ex.category ?? null,
            target_sets: ex.target_sets ?? null,
            target_reps: ex.target_reps ?? null,
            target_weights: ex.target_weights ?? null,
            target_rir: ex.target_rir ?? null,
            rest_seconds: ex.rest_seconds ?? null,
            notes: ex.notes ?? null,
            is_locked: !!ex.is_locked,
            linked_partner_group: ex.linked_partner_group ?? null,
            library_exercise_id: ex.library_exercise_id ?? null,
            sort_order: i,
          } as any)
          .select("id")
          .single();
        if (exRow) exerciseIds[`${key}:${i}`] = exRow.id;
      }
    }
  }

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
    await assertCoach(context);
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
    await assertCoach(context);
    const A = await persistTrainingPlan({
      customerId: data.customerId, uploadedBy: context.userId, title: data.title,
      startDate: data.startDate, weeksCount: data.weeksCount, days: data.clientDays, publish: data.publish,
    });
    const B = await persistTrainingPlan({
      customerId: data.partnerId, uploadedBy: context.userId, title: data.title,
      startDate: data.startDate, weeksCount: data.weeksCount, days: data.partnerDays, publish: data.publish,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("nutrition_plans").update({ is_partner_plan: true, partner_plan_id: B.plan_id } as any).eq("id", A.plan_id);
    await supabaseAdmin.from("nutrition_plans").update({ is_partner_plan: true, partner_plan_id: A.plan_id } as any).eq("id", B.plan_id);

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
      await supabaseAdmin.from("training_exercises").update({ partner_exercise_id: bid } as any).eq("id", aid);
      await supabaseAdmin.from("training_exercises").update({ partner_exercise_id: aid } as any).eq("id", bid);
    }

    return { ok: true, client_plan_id: A.plan_id, partner_plan_id: B.plan_id };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  SCORE_ALGORITHM_VERSION,
  computeCheckV2,
  type CategoryScore,
  type ExerciseCalc,
  type RawResult,
} from "@/lib/strengthScoreV2";

export type StrengthTestKey =
  | "leg_press"
  | "leg_curl"
  | "chest_press"
  | "shoulder_press"
  | "lat_pulldown"
  | "cable_row"
  | "plank";

export const STRENGTH_TESTS: { key: StrengthTestKey; label: string; group: "lower" | "push" | "pull" | "core"; kind: "weighted" | "time" }[] = [
  { key: "leg_press", label: "Beinpresse", group: "lower", kind: "weighted" },
  { key: "leg_curl", label: "Beinbeuger Maschine", group: "lower", kind: "weighted" },
  { key: "chest_press", label: "Brustpresse Maschine", group: "push", kind: "weighted" },
  { key: "shoulder_press", label: "Schulterpresse Maschine", group: "push", kind: "weighted" },
  { key: "lat_pulldown", label: "Latzug", group: "pull", kind: "weighted" },
  { key: "cable_row", label: "Kabelrudern", group: "pull", kind: "weighted" },
  { key: "plank", label: "Plank Hold", group: "core", kind: "time" },
];

export type StrengthResult = {
  id?: string;
  test_key: StrengthTestKey;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  pain_note: string | null;
  e1rm_kg?: number | null;
};

export type StrengthCheck = {
  id: string;
  user_id: string;
  performed_at: string;
  status: "draft" | "completed";
  bodyweight_kg: number | null;
  /** Exaktes Körpergewicht, das für Strength Score V2 verwendet wurde (reproduzierbar). */
  scoring_bodyweight_kg?: number | null;
  notes: string | null;
  score_lower: number | null;
  score_push: number | null;
  score_pull: number | null;
  score_core: number | null;
  score_total: number | null;
  completed_at: string | null;
  /** V2 additions — computed on read from raw results. */
  score_algorithm_version?: number;
  category_confidence?: {
    lower: CategoryScore;
    push: CategoryScore;
    pull: CategoryScore;
    core: CategoryScore;
    overall: CategoryScore;
  };
  exercise_calcs?: Record<StrengthTestKey, ExerciseCalc>;
};

/**
 * Overwrites `score_*` fields on a completed check with Strength Score V2
 * values computed from raw results + bodyweight. Draft rows are returned
 * unchanged.
 */
function applyV2Scores<T extends StrengthCheck>(
  check: T,
  results: RawResult[],
  bodyweightOverride?: number | null,
): T {
  // Legacy fallback: if the row was written under the old algorithm we
  // recompute V2 on the fly from raw results. New rows already store V2.
  const isV2 = (check as { score_algorithm_version?: number | null }).score_algorithm_version === SCORE_ALGORITHM_VERSION;
  if (isV2) return check;

  const bw = bodyweightOverride
    ?? (check as { scoring_bodyweight_kg?: number | null }).scoring_bodyweight_kg
    ?? check.bodyweight_kg;
  const v2 = computeCheckV2(results, bw);
  return {
    ...check,
    score_lower: v2.categories.lower.score,
    score_push: v2.categories.push.score,
    score_pull: v2.categories.pull.score,
    score_core: v2.categories.core.score,
    score_total: v2.overall.score,
    score_algorithm_version: SCORE_ALGORITHM_VERSION,
    category_confidence: {
      lower: v2.categories.lower,
      push: v2.categories.push,
      pull: v2.categories.pull,
      core: v2.categories.core,
      overall: v2.overall,
    },
    exercise_calcs: v2.exercises,
  };
}

export type StrengthStatus = {
  has_ever_completed: boolean;
  last: (StrengthCheck & { results: StrengthResult[] }) | null;
  next_due_at: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
};

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const getMyStrengthStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StrengthStatus> => {
    const { supabase, userId } = context;
    const { data: last } = await supabase
      .from("strength_checks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("performed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let results: StrengthResult[] = [];
    if (last) {
      const { data: rs } = await supabase
        .from("strength_check_results")
        .select("*")
        .eq("check_id", (last as unknown as StrengthCheck).id);
      results = (rs as StrengthResult[]) ?? [];
    }

    const lastDate = last ? new Date((last as unknown as StrengthCheck).performed_at) : null;
    const due = lastDate ? new Date(lastDate.getTime() + 42 * 86400000) : null;
    const today = new Date();
    const dueDays = due ? daysBetween(today, due) : null;

    const lastWithV2 = last
      ? { ...applyV2Scores(last as unknown as StrengthCheck, results as RawResult[]), results }
      : null;

    return {
      has_ever_completed: !!last,
      last: lastWithV2,
      next_due_at: due ? due.toISOString().slice(0, 10) : null,
      is_overdue: due ? today >= due : false,
      days_until_due: dueDays,
    };
  });

export const getMyStrengthHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Need full row + results to recompute V2.
    const { data: checks } = await supabase
      .from("strength_checks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("performed_at", { ascending: true });
    const rows = (checks ?? []) as unknown as StrengthCheck[];
    if (rows.length === 0) return [] as Array<Pick<StrengthCheck, "id" | "performed_at" | "score_lower" | "score_push" | "score_pull" | "score_core" | "score_total">>;
    const ids = rows.map((r) => r.id);
    const { data: allResults } = await supabase
      .from("strength_check_results")
      .select("*")
      .in("check_id", ids);
    const byCheck = new Map<string, RawResult[]>();
    for (const r of (allResults ?? []) as (RawResult & { check_id: string })[]) {
      const list = byCheck.get(r.check_id) ?? [];
      list.push(r);
      byCheck.set(r.check_id, list);
    }
    return rows.map((row) => {
      const withV2 = applyV2Scores(row, byCheck.get(row.id) ?? []);
      return {
        id: withV2.id,
        performed_at: withV2.performed_at,
        score_lower: withV2.score_lower,
        score_push: withV2.score_push,
        score_pull: withV2.score_pull,
        score_core: withV2.score_core,
        score_total: withV2.score_total,
      };
    });
  });

export const startStrengthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { bodyweight_kg?: number | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Reuse an existing draft if present.
    const { data: existing } = await supabase
      .from("strength_checks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      if (data.bodyweight_kg && !(existing as unknown as StrengthCheck).bodyweight_kg) {
        await supabase
          .from("strength_checks")
          .update({ bodyweight_kg: data.bodyweight_kg })
          .eq("id", (existing as unknown as StrengthCheck).id);
      }
      return existing as unknown as StrengthCheck;
    }
    const { data: row, error } = await supabase
      .from("strength_checks")
      .insert({ user_id: userId, status: "draft", bodyweight_kg: data.bodyweight_kg ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as StrengthCheck;
  });

export const saveStrengthResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      check_id: string;
      test_key: StrengthTestKey;
      weight_kg: number | null;
      reps: number | null;
      duration_seconds: number | null;
      rpe: number | null;
      pain_note: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Guard: only operate on draft you own
    const { data: chk } = await supabase
      .from("strength_checks")
      .select("id, status, user_id")
      .eq("id", data.check_id)
      .maybeSingle();
    if (!chk || chk.user_id !== userId) throw new Error("Nicht gefunden");
    if (chk.status === "completed") throw new Error("Check ist bereits abgeschlossen");

    const payload = {
      check_id: data.check_id,
      user_id: userId,
      test_key: data.test_key,
      weight_kg: data.weight_kg,
      reps: data.reps,
      duration_seconds: data.duration_seconds,
      rpe: data.rpe,
      pain_note: data.pain_note?.slice(0, 500) ?? null,
    };
    const { data: row, error } = await supabase
      .from("strength_check_results")
      .upsert(payload, { onConflict: "check_id,test_key" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as StrengthResult;
  });

export const completeStrengthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { check_id: string; bodyweight_kg?: number | null; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chk } = await supabase
      .from("strength_checks")
      .select("id, user_id, status, bodyweight_kg, performed_at")
      .eq("id", data.check_id)
      .maybeSingle();
    if (!chk || chk.user_id !== userId) throw new Error("Nicht gefunden");
    if (chk.status === "completed") throw new Error("Bereits abgeschlossen");

    // Load full raw results.
    const { data: fullResults } = await supabase
      .from("strength_check_results")
      .select("*")
      .eq("check_id", data.check_id);
    const rawResults = (fullResults ?? []) as unknown as RawResult[];
    if (rawResults.length < 4) throw new Error("Bitte mindestens 4 Tests eintragen.");

    // Resolve scoring bodyweight per priority:
    //  1) explicit payload value
    //  2) bodyweight already stored on the check (entered at test time)
    //  3) latest body_measurement measured AT or BEFORE performed_at
    //  4) nearest body_measurement (fallback when no prior measurement exists)
    const performedAt = (chk as { performed_at: string }).performed_at;
    let bodyweight: number | null =
      data.bodyweight_kg ?? (chk as { bodyweight_kg: number | null }).bodyweight_kg ?? null;
    if (bodyweight == null) {
      const { data: bmBefore } = await supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .lte("measured_at", performedAt)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bmBefore?.weight_kg != null) {
        bodyweight = Number(bmBefore.weight_kg);
      } else {
        const { data: bmAny } = await supabase
          .from("body_measurements")
          .select("weight_kg, measured_at")
          .eq("user_id", userId)
          .not("weight_kg", "is", null)
          .order("measured_at", { ascending: true });
        if (bmAny && bmAny.length > 0) {
          const target = new Date(performedAt).getTime();
          let best = bmAny[0];
          let bestDiff = Math.abs(new Date(best.measured_at).getTime() - target);
          for (const row of bmAny) {
            const diff = Math.abs(new Date(row.measured_at).getTime() - target);
            if (diff < bestDiff) { best = row; bestDiff = diff; }
          }
          if (best?.weight_kg != null) bodyweight = Number(best.weight_kg);
        }
      }
    }

    // Compute Strength Score V2 (single source of truth).
    const v2 = computeCheckV2(rawResults, bodyweight);

    const update: {
      status: "completed";
      bodyweight_kg?: number | null;
      scoring_bodyweight_kg: number | null;
      notes?: string | null;
      score_lower: number | null;
      score_push: number | null;
      score_pull: number | null;
      score_core: number | null;
      score_total: number | null;
      score_algorithm_version: number;
      category_confidence: Json;
      exercise_calcs: Json;
      score_calculated_at: string;
    } = {
      status: "completed",
      scoring_bodyweight_kg: bodyweight,
      score_lower: v2.categories.lower.score,
      score_push: v2.categories.push.score,
      score_pull: v2.categories.pull.score,
      score_core: v2.categories.core.score,
      score_total: v2.overall.score,
      score_algorithm_version: SCORE_ALGORITHM_VERSION,
      category_confidence: ({
        lower: v2.categories.lower,
        push: v2.categories.push,
        pull: v2.categories.pull,
        core: v2.categories.core,
        overall: v2.overall,
      } as unknown) as Json,
      exercise_calcs: (v2.exercises as unknown) as Json,
      score_calculated_at: new Date().toISOString(),
    };
    if (data.bodyweight_kg != null) update.bodyweight_kg = data.bodyweight_kg;
    if (data.notes != null) update.notes = data.notes.slice(0, 1000);

    const { data: row, error } = await supabase
      .from("strength_checks")
      .update(update)
      .eq("id", data.check_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as StrengthCheck;
  });

export const deleteStrengthResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { check_id: string; test_key: StrengthTestKey }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("strength_check_results")
      .delete()
      .eq("check_id", data.check_id)
      .eq("test_key", data.test_key)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Coach: read another user's overview (RLS allows via has_role)
export const getCustomerStrengthOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach && userId !== data.user_id) throw new Error("Forbidden");

    const { data: history } = await supabase
      .from("strength_checks")
      .select("*")
      .eq("user_id", data.user_id)
      .eq("status", "completed")
      .order("performed_at", { ascending: true });
    const rawHistory = (history ?? []) as unknown as StrengthCheck[];

    // Load ALL results in one query, then recompute V2 per check.
    const ids = rawHistory.map((c) => c.id);
    let allResults: (RawResult & { check_id: string })[] = [];
    if (ids.length) {
      const { data: rs } = await supabase
        .from("strength_check_results")
        .select("*")
        .in("check_id", ids);
      allResults = (rs as (RawResult & { check_id: string })[]) ?? [];
    }
    const byCheck = new Map<string, (RawResult & { check_id: string })[]>();
    for (const r of allResults) {
      const list = byCheck.get(r.check_id) ?? [];
      list.push(r);
      byCheck.set(r.check_id, list);
    }

    const historyV2 = rawHistory.map((c) => applyV2Scores(c, byCheck.get(c.id) ?? []));
    const last = historyV2.length ? historyV2[historyV2.length - 1] : null;
    const lastResults = last ? (byCheck.get(last.id) ?? []) as unknown as StrengthResult[] : [];

    return {
      history: historyV2,
      last: last ? { ...last, results: lastResults } : null,
    };
  });

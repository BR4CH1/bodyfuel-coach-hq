import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  const bw = bodyweightOverride ?? check.bodyweight_kg;
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
        .eq("check_id", (last as StrengthCheck).id);
      results = (rs as StrengthResult[]) ?? [];
    }

    const lastDate = last ? new Date((last as StrengthCheck).performed_at) : null;
    const due = lastDate ? new Date(lastDate.getTime() + 42 * 86400000) : null;
    const today = new Date();
    const dueDays = due ? daysBetween(today, due) : null;

    return {
      has_ever_completed: !!last,
      last: last ? { ...(last as StrengthCheck), results } : null,
      next_due_at: due ? due.toISOString().slice(0, 10) : null,
      is_overdue: due ? today >= due : false,
      days_until_due: dueDays,
    };
  });

export const getMyStrengthHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("strength_checks")
      .select("id, performed_at, score_lower, score_push, score_pull, score_core, score_total")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("performed_at", { ascending: true });
    return (data ?? []) as Array<Pick<StrengthCheck, "id" | "performed_at" | "score_lower" | "score_push" | "score_pull" | "score_core" | "score_total">>;
  });

export const startStrengthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bodyweight_kg?: number | null }) => d)
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
      if (data.bodyweight_kg && !(existing as StrengthCheck).bodyweight_kg) {
        await supabase
          .from("strength_checks")
          .update({ bodyweight_kg: data.bodyweight_kg })
          .eq("id", (existing as StrengthCheck).id);
      }
      return existing as StrengthCheck;
    }
    const { data: row, error } = await supabase
      .from("strength_checks")
      .insert({ user_id: userId, status: "draft", bodyweight_kg: data.bodyweight_kg ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as StrengthCheck;
  });

export const saveStrengthResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
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
  .inputValidator((d: { check_id: string; bodyweight_kg?: number | null; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chk } = await supabase
      .from("strength_checks")
      .select("id, user_id, status")
      .eq("id", data.check_id)
      .maybeSingle();
    if (!chk || chk.user_id !== userId) throw new Error("Nicht gefunden");
    if (chk.status === "completed") throw new Error("Bereits abgeschlossen");

    // Require at least 4 of 7 tests entered
    const { data: results } = await supabase
      .from("strength_check_results")
      .select("test_key")
      .eq("check_id", data.check_id);
    if (!results || results.length < 4) throw new Error("Bitte mindestens 4 Tests eintragen.");

    const update: { status: "completed"; bodyweight_kg?: number | null; notes?: string | null } = { status: "completed" };
    if (data.bodyweight_kg != null) update.bodyweight_kg = data.bodyweight_kg;
    if (data.notes != null) update.notes = data.notes.slice(0, 1000);
    const { data: row, error } = await supabase
      .from("strength_checks")
      .update(update)
      .eq("id", data.check_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as StrengthCheck;
  });

export const deleteStrengthResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { check_id: string; test_key: StrengthTestKey }) => d)
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
  .inputValidator((d: { user_id: string }) => d)
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
    const last = (history ?? []).slice(-1)[0] as StrengthCheck | undefined;

    let lastResults: StrengthResult[] = [];
    if (last) {
      const { data: rs } = await supabase
        .from("strength_check_results")
        .select("*")
        .eq("check_id", last.id);
      lastResults = (rs as StrengthResult[]) ?? [];
    }
    return {
      history: (history ?? []) as StrengthCheck[],
      last: last ? { ...last, results: lastResults } : null,
    };
  });

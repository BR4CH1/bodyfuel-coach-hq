import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// FRAMEWORK QUERIES
// ============================================================

export const getOrgPerformanceFramework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: framework } = await supabase
      .from("performance_frameworks")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!framework) return { framework: null };

    const [domains, batteries, positions, benchmarks, metrics] = await Promise.all([
      supabase.from("performance_domains").select("*").eq("framework_id", framework.id).order("order_index"),
      supabase.from("performance_test_batteries").select("*").eq("framework_id", framework.id),
      supabase.from("performance_position_profiles").select("*").eq("framework_id", framework.id),
      supabase.from("performance_benchmark_models").select("*").eq("framework_id", framework.id),
      supabase.from("performance_metric_definitions").select("*").eq("framework_id", framework.id),
    ]);

    const batteryIds = (batteries.data ?? []).map((b) => b.id);
    const testsRes = batteryIds.length
      ? await supabase.from("performance_test_definitions").select("*").in("battery_id", batteryIds)
      : { data: [] as never[] };

    return {
      framework,
      domains: domains.data ?? [],
      batteries: batteries.data ?? [],
      tests: testsRes.data ?? [],
      metrics: metrics.data ?? [],
      positions: positions.data ?? [],
      benchmarks: benchmarks.data ?? [],
    };
  });

// ============================================================
// FRAMEWORK MUTATIONS (minimal Rohbau CRUD)
// ============================================================

export const createBattery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { framework_id: string; organization_id: string; name: string; description?: string; recommended_retest_days?: number | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("performance_test_batteries")
      .insert({
        framework_id: data.framework_id,
        organization_id: data.organization_id,
        name: data.name,
        description: data.description ?? null,
        recommended_retest_days: data.recommended_retest_days ?? null,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createTestDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    battery_id: string;
    key: string;
    name: string;
    unit: string;
    value_type: "number" | "duration_seconds" | "distance_m";
    direction: "higher_is_better" | "lower_is_better" | "target_range";
    domain_id?: string | null;
    decimal_places?: number;
    result_selection?: "best" | "average" | "median" | "last" | "custom";
    required?: boolean;
    recommended_retest_days?: number | null;
    protocol?: Record<string, unknown>;
    description?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("performance_test_definitions")
      .insert({
        battery_id: data.battery_id,
        key: data.key,
        name: data.name,
        unit: data.unit,
        value_type: data.value_type,
        direction: data.direction,
        domain_id: data.domain_id ?? null,
        decimal_places: data.decimal_places ?? 2,
        result_selection: data.result_selection ?? "best",
        required: data.required ?? false,
        recommended_retest_days: data.recommended_retest_days ?? null,
        protocol: (data.protocol ?? {}) as never,
        description: data.description ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createMetricDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    framework_id: string;
    key: string;
    name: string;
    domain_id?: string | null;
    metric_type?: "raw_test" | "derived";
    calculation_type: "direct" | "ratio" | "percentage_difference" | "asymmetry" | "bodyweight_relative" | "formula";
    direction?: "higher_is_better" | "lower_is_better" | "target_range";
    config: Record<string, unknown>;
    unit?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    if (data.calculation_type === "formula") throw new Error("formula calculation_type is disabled in V1");
    const { data: row, error } = await context.supabase
      .from("performance_metric_definitions")
      .insert({
        framework_id: data.framework_id,
        key: data.key,
        name: data.name,
        domain_id: data.domain_id ?? null,
        metric_type: data.metric_type ?? (data.calculation_type === "direct" ? "raw_test" : "derived"),
        calculation_type: data.calculation_type,
        direction: data.direction ?? "higher_is_better",
        config: (data.config ?? {}) as never,
        unit: data.unit ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertDomainMetricWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { framework_id: string; domain_id: string; metric_definition_id: string; weight: number }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_domain_metric_weights")
      .upsert(data, { onConflict: "framework_id,domain_id,metric_definition_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPositionDomainWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { position_profile_id: string; domain_id: string; weight: number }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_position_domain_weights")
      .upsert(data, { onConflict: "position_profile_id,domain_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// SESSIONS
// ============================================================

export const listPerformanceSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("performance_test_sessions")
      .select("id, name, test_date, status, battery_id, team_id, created_at")
      .eq("organization_id", data.organization_id)
      .order("test_date", { ascending: false });
    return rows ?? [];
  });

export const createPerformanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; battery_id: string; name: string; test_date: string; team_id?: string | null; athlete_user_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("performance_test_sessions")
      .insert({
        organization_id: data.organization_id,
        battery_id: data.battery_id,
        team_id: data.team_id ?? null,
        name: data.name,
        test_date: data.test_date,
        status: "planned",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Failed to create session");
    if (data.athlete_user_ids.length > 0) {
      await context.supabase.from("performance_test_session_athletes").insert(
        data.athlete_user_ids.map((uid) => ({ session_id: session.id, user_id: uid })),
      );
    }
    return session;
  });

export const getPerformanceSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: session } = await supabase.from("performance_test_sessions").select("*").eq("id", data.session_id).single();
    if (!session) throw new Error("Session not found");
    const [athletes, attempts, snapshots, battery] = await Promise.all([
      supabase.from("performance_test_session_athletes").select("*").eq("session_id", session.id),
      supabase.from("performance_test_attempts").select("*").eq("session_id", session.id).order("measured_at"),
      supabase.from("performance_session_context_snapshots").select("*").eq("session_id", session.id),
      supabase.from("performance_test_batteries").select("*").eq("id", session.battery_id).single(),
    ]);
    const testsRes = battery.data
      ? await supabase.from("performance_test_definitions").select("*").eq("battery_id", battery.data.id).order("order_index")
      : { data: [] };
    return {
      session,
      battery: battery.data,
      tests: testsRes.data ?? [],
      athletes: athletes.data ?? [],
      attempts: attempts.data ?? [],
      snapshots: snapshots.data ?? [],
    };
  });

export const addTestAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    session_id: string;
    user_id: string;
    test_definition_id: string;
    raw_value: number;
    unit_snapshot: string;
    valid?: boolean;
    invalid_reason?: string | null;
    attempt_number?: number;
    organization_id: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("performance_test_attempts")
      .insert({
        session_id: data.session_id,
        user_id: data.user_id,
        test_definition_id: data.test_definition_id,
        organization_id: data.organization_id,
        raw_value: data.raw_value,
        unit_snapshot: data.unit_snapshot,
        attempt_number: data.attempt_number ?? 1,
        valid: data.valid ?? true,
        invalid_reason: data.invalid_reason ?? null,
        entered_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const invalidateAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attempt_id: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_test_attempts")
      .update({ valid: false, invalid_reason: data.reason })
      .eq("id", data.attempt_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completePerformanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error: uErr } = await context.supabase
      .from("performance_test_sessions")
      .update({ status: "completed" })
      .eq("id", data.session_id);
    if (uErr) throw new Error(uErr.message);
    const { runPerformanceProfileCalculation } = await import("./pipeline.server");
    const result = await runPerformanceProfileCalculation(context.supabase, { session_id: data.session_id });
    return result;
  });

// ============================================================
// ATHLETE + TEAM VIEWS
// ============================================================

export const getAthletePerformanceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id?: string }) => d)
  .handler(async ({ data, context }) => {
    const uid = data.user_id ?? context.userId;
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("performance_athlete_profiles")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("user_id", uid)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!profile) return { profile: null };

    const [domains, metricScores, focusAreas, domainsMeta] = await Promise.all([
      supabase.from("performance_athlete_domain_scores").select("*").eq("profile_id", profile.id),
      supabase.from("performance_athlete_metric_scores").select("*").eq("profile_id", profile.id),
      supabase.from("performance_athlete_focus_areas").select("*").eq("user_id", uid).eq("framework_id", profile.framework_id).order("priority"),
      supabase.from("performance_domains").select("id, key, name, active").eq("framework_id", profile.framework_id),
    ]);
    return {
      profile,
      domainScores: domains.data ?? [],
      metricScores: metricScores.data ?? [],
      focusAreas: focusAreas.data ?? [],
      domains: domainsMeta.data ?? [],
    };
  });

export const getPerformanceTeamMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profiles } = await supabase
      .from("performance_athlete_profiles")
      .select("id, user_id, overall_score, confidence, data_coverage, framework_id, position_profile_id")
      .eq("organization_id", data.organization_id);
    const profileIds = (profiles ?? []).map((p) => p.id);
    const domainScoresRes = profileIds.length
      ? await supabase.from("performance_athlete_domain_scores").select("profile_id, domain_id, score").in("profile_id", profileIds)
      : { data: [] as never[] };
    const userIds = (profiles ?? []).map((p) => p.user_id);
    const teamRowsRes = userIds.length
      ? await context.supabase
          .from("team_memberships")
          .select("user_id, position, team_id, organization_teams!inner(organization_id)")
          .in("user_id", userIds)
          .eq("organization_teams.organization_id", data.organization_id)
      : { data: [] as never[] };
    const profilesFetch = userIds.length
      ? await context.supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as never[] };
    return {
      profiles: profiles ?? [],
      domainScores: domainScoresRes.data ?? [],
      memberships: (teamRowsRes.data ?? []).map((r) => ({ user_id: r.user_id, position: r.position, team_id: r.team_id })),
      users: (profilesFetch.data ?? []).map((u) => ({ user_id: u.id, name: u.display_name ?? "" })),
    };
  });

// ============================================================
// COACH FOCUS OVERRIDES
// ============================================================

export const upsertCoachFocusArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id: string; framework_id: string; domain_id?: string | null; label: string; priority: number; status?: "suggested" | "confirmed" | "dismissed"; id?: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("performance_athlete_focus_areas")
        .update({ label: data.label, priority: data.priority, status: data.status ?? "confirmed", domain_id: data.domain_id ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("performance_athlete_focus_areas").insert({
        organization_id: data.organization_id,
        user_id: data.user_id,
        framework_id: data.framework_id,
        domain_id: data.domain_id ?? null,
        label: data.label,
        priority: data.priority,
        source: "coach",
        status: data.status ?? "confirmed",
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeCoachFocusArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("performance_athlete_focus_areas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

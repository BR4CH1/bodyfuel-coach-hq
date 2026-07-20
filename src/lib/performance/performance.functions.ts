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
  .inputValidator((d: {
    organization_id: string;
    battery_id: string;
    name: string;
    test_date: string;
    team_id?: string | null;
    athlete_user_ids: string[];
    test_day?: "field" | "strength" | "full" | null;
    entry_mode?: "by_test" | "by_athlete";
    location?: string | null;
    measurement_method_default?: string | null;
    notes?: string | null;
    mode?: "test" | "production";
    bodyweight_snapshots?: Array<{ user_id: string; weight_kg: number; source?: string }>;
  }) => d)
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
        test_day: data.test_day ?? null,
        entry_mode: data.entry_mode ?? "by_test",
        location: data.location ?? null,
        measurement_method_default: data.measurement_method_default ?? null,
        notes: data.notes ?? null,
        mode: data.mode ?? "test",
      } as never)
      .select("*")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Failed to create session");
    if (data.athlete_user_ids.length > 0) {
      await context.supabase.from("performance_test_session_athletes").insert(
        data.athlete_user_ids.map((uid) => ({ session_id: session.id, user_id: uid })),
      );
    }
    if (data.bodyweight_snapshots && data.bodyweight_snapshots.length > 0) {
      await context.supabase.from("performance_session_context_snapshots").insert(
        data.bodyweight_snapshots.map((s) => ({
          session_id: session.id,
          organization_id: data.organization_id,
          user_id: s.user_id,
          context_key: "bodyweight_kg",
          numeric_value: s.weight_kg,
          unit: "kg",
          source: s.source ?? "manual",
          captured_at: new Date().toISOString(),
        })),
      );
    }
    return session;
  });

export const updatePerformanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string; patch: Partial<{ name: string; test_date: string; location: string | null; entry_mode: "by_test" | "by_athlete"; measurement_method_default: string | null; notes: string | null; test_day: "field" | "strength" | "full" | null }> }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_test_sessions")
      .update(data.patch as never)
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startPerformanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_test_sessions")
      .update({ status: "in_progress" })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelPerformanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("performance_test_sessions")
      .update({ status: "canceled" })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSessionBodyweightSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string; organization_id: string; user_id: string; weight_kg: number; source?: string }) => d)
  .handler(async ({ data, context }) => {
    // Delete existing bodyweight_kg snapshot for this session/user, then insert.
    await context.supabase
      .from("performance_session_context_snapshots")
      .delete()
      .eq("session_id", data.session_id)
      .eq("user_id", data.user_id)
      .eq("context_key", "bodyweight_kg");
    const { error } = await context.supabase
      .from("performance_session_context_snapshots")
      .insert({
        session_id: data.session_id,
        organization_id: data.organization_id,
        user_id: data.user_id,
        context_key: "bodyweight_kg",
        numeric_value: data.weight_kg,
        unit: "kg",
        source: data.source ?? "manual",
        captured_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Roster für Test-Session-Auswahl. Athletes = organization_memberships mit role='athlete'
 * plus deren Team + Position + ob bereits ein Performance-Profile existiert.
 */
export const listOrgAthletesForPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("user_id, status, onboarding_completed")
      .eq("organization_id", data.organization_id)
      .eq("role", "athlete")
      .eq("status", "active");
    const userIds = (memberships ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return { athletes: [] as Array<{ user_id: string; name: string; team_id: string | null; team_name: string | null; position: string | null; onboarding_completed: boolean; profile_status: "NO_PROFILE" | "INCOMPLETE" | "PROFILE_AVAILABLE"; last_bodyweight_kg: number | null }> };

    const [teamsRes, profilesRes, perfProfilesRes, bullsRes] = await Promise.all([
      supabase
        .from("team_memberships")
        .select("user_id, position, team_id, organization_teams!inner(id, name, organization_id)")
        .in("user_id", userIds)
        .eq("organization_teams.organization_id", data.organization_id),
      supabase.from("profiles").select("id, display_name").in("id", userIds),
      supabase.from("performance_athlete_profiles").select("user_id, overall_score, data_coverage").eq("organization_id", data.organization_id).in("user_id", userIds),
      supabase.from("bulls_profiles").select("user_id, weight_kg").in("user_id", userIds),
    ]);

    const byUser = new Map(userIds.map((u) => [u, {
      user_id: u,
      name: "",
      team_id: null as string | null,
      team_name: null as string | null,
      position: null as string | null,
      onboarding_completed: false,
      profile_status: "NO_PROFILE" as "NO_PROFILE" | "INCOMPLETE" | "PROFILE_AVAILABLE",
      last_bodyweight_kg: null as number | null,
    }]));
    for (const m of memberships ?? []) {
      const row = byUser.get(m.user_id); if (row) row.onboarding_completed = m.onboarding_completed ?? false;
    }
    for (const p of profilesRes.data ?? []) {
      const row = byUser.get(p.id); if (row) row.name = p.display_name ?? "";
    }
    for (const t of teamsRes.data ?? []) {
      const row = byUser.get(t.user_id);
      if (!row) continue;
      if (data.team_id && t.team_id !== data.team_id) continue;
      row.team_id = t.team_id;
      row.position = t.position ?? null;
      row.team_name = (t.organization_teams as any)?.name ?? null;
    }
    for (const p of perfProfilesRes.data ?? []) {
      const row = byUser.get(p.user_id); if (!row) continue;
      row.profile_status = p.overall_score == null
        ? "INCOMPLETE"
        : "PROFILE_AVAILABLE";
    }
    for (const b of bullsRes.data ?? []) {
      const row = byUser.get(b.user_id); if (row) row.last_bodyweight_kg = b.weight_kg != null ? Number(b.weight_kg) : null;
    }
    let athletes = Array.from(byUser.values());
    if (data.team_id) athletes = athletes.filter((a) => a.team_id === data.team_id);
    athletes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return { athletes };
  });

/**
 * Session progress: per Athlete/Test → OK/PROVISIONAL/INCOMPLETE/NO_VALID_ATTEMPTS/REVIEW_REQUIRED
 * Wird von der Session-UI und der Completion-Review verwendet.
 */
export const getPerformanceSessionProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { computeTestResult } = await import("./test-result");
    const { supabase } = context;
    const { data: session } = await supabase.from("performance_test_sessions").select("*").eq("id", data.session_id).single();
    if (!session) throw new Error("Session not found");
    const [{ data: athletes }, { data: attempts }, { data: battery }] = await Promise.all([
      supabase.from("performance_test_session_athletes").select("*").eq("session_id", data.session_id),
      supabase.from("performance_test_attempts").select("id, user_id, test_definition_id, raw_value, unit_snapshot, valid, measured_at").eq("session_id", data.session_id),
      supabase.from("performance_test_batteries").select("id").eq("id", session.battery_id).single(),
    ]);
    const testsRes = battery ? await supabase.from("performance_test_definitions").select("*").eq("battery_id", battery.id).eq("active", true).order("order_index") : { data: [] };
    const tests = testsRes.data ?? [];

    type Cell = { user_id: string; test_definition_id: string; status: string; valid_count: number; selected_value: number | null; unit: string | null; incomplete_reason?: string };
    const cells: Cell[] = [];
    for (const a of athletes ?? []) {
      for (const t of tests) {
        const testAttempts = (attempts ?? []).filter((x) => x.user_id === a.user_id && x.test_definition_id === t.id);
        const r = computeTestResult({
          attempts: testAttempts.map((x) => ({ id: x.id, raw_value: Number(x.raw_value), unit_snapshot: x.unit_snapshot, valid: x.valid, measured_at: x.measured_at })),
          method: (t.result_selection as any) ?? "best",
          direction: (t.direction as any) ?? "higher_is_better",
          unit: t.unit,
          config: (t.config as any) ?? null,
        });
        cells.push({
          user_id: a.user_id,
          test_definition_id: t.id,
          status: r.test_status,
          valid_count: r.valid_count,
          selected_value: r.selected_value,
          unit: r.unit ?? null,
          incomplete_reason: r.incomplete_reason,
        });
      }
    }
    const totalCells = cells.length;
    const completeCells = cells.filter((c) => c.status === "OK").length;
    const athletesComplete = (athletes ?? []).filter((a) => tests.every((t) => cells.find((c) => c.user_id === a.user_id && c.test_definition_id === t.id)?.status === "OK")).length;
    return {
      session,
      tests,
      athletes: athletes ?? [],
      cells,
      progress: {
        athletes_total: athletes?.length ?? 0,
        athletes_complete: athletesComplete,
        cells_total: totalCells,
        cells_complete: completeCells,
      },
    };
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

    const [domains, metricScores, focusAreas, domainsMeta, metricDefs, retestRows] = await Promise.all([
      supabase.from("performance_athlete_domain_scores").select("*").eq("profile_id", profile.id),
      supabase.from("performance_athlete_metric_scores").select("*").eq("profile_id", profile.id),
      supabase.from("performance_athlete_focus_areas").select("*").eq("user_id", uid).eq("framework_id", profile.framework_id).order("priority"),
      supabase.from("performance_domains").select("id, key, name, active").eq("framework_id", profile.framework_id),
      supabase.from("performance_metric_definitions").select("id, key, name, unit, domain_id, active").eq("framework_id", profile.framework_id),
      supabase.from("performance_retest_schedule").select("test_definition_id, next_retest_due, last_tested_at").eq("organization_id", data.organization_id).eq("user_id", uid).order("next_retest_due", { ascending: true }),
    ]);
    return {
      profile,
      domainScores: domains.data ?? [],
      metricScores: metricScores.data ?? [],
      focusAreas: focusAreas.data ?? [],
      domains: domainsMeta.data ?? [],
      metricDefinitions: metricDefs.data ?? [],
      nextRetest: retestRows.data?.[0] ?? null,
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

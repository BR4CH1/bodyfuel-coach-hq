/**
 * Server-side pipeline for a completed performance test session.
 * Runs the entire scoring chain: selected results → derived metrics →
 * benchmark eligibility → metric scores → domain scores → overall profile →
 * confidence → focus areas → retest schedule.
 *
 * Loaded lazily inside server-function handlers (never at module scope) so
 * `client.server` never leaks into the client bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  selectPerformanceResult,
  calculateDerivedMetric,
  calculateMetricScoreInternal,
  calculateDomainScore,
  calculateOverallPerformanceProfile,
  calculateProfileConfidence,
  deriveDevelopmentFocusAreas,
  calculateRetestDue,
  type Direction,
  type ResultSelectionMethod,
  type CalculationType,
} from "@/lib/performance";

type SB = SupabaseClient<Database>;

export async function runPerformanceProfileCalculation(
  supabase: SB,
  input: { session_id: string; framework_id?: string | null },
): Promise<{ profiles_updated: number; notes: string[] }> {
  const notes: string[] = [];

  // 1. Load session + org + battery
  const { data: session, error: sErr } = await supabase
    .from("performance_test_sessions")
    .select("id, organization_id, battery_id, test_date")
    .eq("id", input.session_id)
    .single();
  if (sErr || !session) throw new Error(sErr?.message ?? "Session not found");

  const { data: battery } = await supabase
    .from("performance_test_batteries")
    .select("id, framework_id, recommended_retest_days")
    .eq("id", session.battery_id)
    .single();
  if (!battery) throw new Error("Battery not found");

  const framework_id = input.framework_id ?? battery.framework_id;

  // 2. Load framework config in bulk
  const [{ data: framework }, { data: domains }, { data: tests }, { data: metrics }, { data: domainWeights }, { data: benchmarks }] = await Promise.all([
    supabase.from("performance_frameworks").select("id, version, status").eq("id", framework_id).single(),
    supabase.from("performance_domains").select("id, key, name, active").eq("framework_id", framework_id).eq("active", true),
    supabase.from("performance_test_definitions").select("id, key, unit, direction, result_selection, required, active, config, domain_id, recommended_retest_days").eq("battery_id", battery.id),
    supabase.from("performance_metric_definitions").select("id, key, domain_id, metric_type, calculation_type, direction, config, active").eq("framework_id", framework_id).eq("active", true),
    supabase.from("performance_domain_metric_weights").select("domain_id, metric_definition_id, weight, active").eq("framework_id", framework_id).eq("active", true),
    supabase.from("performance_benchmark_models").select("id, benchmark_type, version, minimum_sample_size, status, config").eq("framework_id", framework_id),
  ]);

  if (!framework) throw new Error("Framework not found");

  const internalBenchmark = (benchmarks ?? []).find((b) => b.benchmark_type === "organization_internal" && b.status !== "draft") ?? null;

  // 3. Session athletes
  const { data: sessionAthletes } = await supabase
    .from("performance_test_session_athletes")
    .select("user_id")
    .eq("session_id", session.id);

  const athleteIds = (sessionAthletes ?? []).map((r) => r.user_id);
  if (athleteIds.length === 0) {
    notes.push("No athletes on session");
    return { profiles_updated: 0, notes };
  }

  // 4. Load all attempts for this session
  const { data: allAttempts } = await supabase
    .from("performance_test_attempts")
    .select("id, user_id, test_definition_id, raw_value, unit_snapshot, valid, measured_at")
    .eq("session_id", session.id);

  // 5. Load context snapshots
  const { data: allSnapshots } = await supabase
    .from("performance_session_context_snapshots")
    .select("user_id, context_key, numeric_value")
    .eq("session_id", session.id);

  // Build maps
  const testById = new Map((tests ?? []).map((t) => [t.id, t]));
  const testByKey = new Map((tests ?? []).map((t) => [t.key, t]));
  const domainById = new Map((domains ?? []).map((d) => [d.id, d]));

  // 6. Per athlete: compute selected results per test, then metric values, then scores.
  let profilesUpdated = 0;

  for (const userId of athleteIds) {
    const attemptsByTest = new Map<string, typeof allAttempts>();
    for (const a of allAttempts ?? []) {
      if (a.user_id !== userId) continue;
      const arr = attemptsByTest.get(a.test_definition_id) ?? [];
      arr.push(a);
      attemptsByTest.set(a.test_definition_id, arr);
    }
    const contextValues: Record<string, number> = {};
    for (const s of allSnapshots ?? []) {
      if (s.user_id !== userId || s.numeric_value == null) continue;
      contextValues[s.context_key] = Number(s.numeric_value);
    }

    // 6a. Selected result per test (keyed by test.key for derived metric lookup)
    const selectedByTestKey = new Map<string, number | null>();
    for (const t of tests ?? []) {
      const attempts = attemptsByTest.get(t.id) ?? [];
      const sel = selectPerformanceResult({
        attempts: attempts.map((a) => ({
          id: a.id,
          raw_value: Number(a.raw_value),
          unit_snapshot: a.unit_snapshot,
          valid: a.valid,
          measured_at: a.measured_at,
        })),
        method: (t.result_selection as ResultSelectionMethod) ?? "best",
        direction: (t.direction as Direction) ?? "higher_is_better",
        unit: t.unit,
      });
      selectedByTestKey.set(t.key, sel.status === "OK" ? sel.selected_value : null);
    }

    // 6b. Metric values (direct + derived)
    const metricValueById = new Map<string, number | null>();
    const metricKeyToId = new Map<string, string>();
    for (const m of metrics ?? []) metricKeyToId.set(m.key, m.id);

    // Two passes: direct first, then derived (may reference direct metric keys)
    for (const m of metrics ?? []) {
      if (m.calculation_type !== "direct") continue;
      const testKey = (m.config as { input_metric_key?: string }).input_metric_key ?? m.key;
      metricValueById.set(m.id, selectedByTestKey.get(testKey) ?? null);
    }
    // Build metric-key value map from selectedByTestKey merged with computed direct
    const metricValuesForDerived: Record<string, number | null> = {};
    for (const [k, v] of selectedByTestKey.entries()) metricValuesForDerived[k] = v;
    for (const m of metrics ?? []) {
      if (m.calculation_type === "direct") metricValuesForDerived[m.key] = metricValueById.get(m.id) ?? null;
    }

    for (const m of metrics ?? []) {
      if (m.calculation_type === "direct") continue;
      const r = calculateDerivedMetric({
        calculationType: m.calculation_type as CalculationType,
        config: (m.config as Record<string, string>) ?? {},
        metricValues: metricValuesForDerived,
        contextValues,
      });
      metricValueById.set(m.id, r.status === "OK" ? r.value : null);
      if (r.status === "OK") metricValuesForDerived[m.key] = r.value;
    }

    // 6c. Metric scores against internal benchmark (if configured and has peers).
    // For V1 we compute peer values from THIS session only. When the benchmark is
    // organization_internal with a real minimum_sample_size the org-wide pool
    // should extend to historical selected results; we defer that to a later card.
    const metricScoreRows: Array<{
      metric_definition_id: string;
      score: number | null;
      selected_value: number | null;
      unit: string | null;
      benchmark_model_id: string | null;
      benchmark_version: number | null;
      sample_size: number | null;
      comparison_group: Record<string, unknown>;
    }> = [];

    for (const m of metrics ?? []) {
      const value = metricValueById.get(m.id);
      if (typeof value !== "number") {
        metricScoreRows.push({
          metric_definition_id: m.id,
          score: null,
          selected_value: null,
          unit: null,
          benchmark_model_id: null,
          benchmark_version: null,
          sample_size: null,
          comparison_group: {},
        });
        continue;
      }
      if (!internalBenchmark) {
        metricScoreRows.push({
          metric_definition_id: m.id,
          score: null,
          selected_value: value,
          unit: null,
          benchmark_model_id: null,
          benchmark_version: null,
          sample_size: null,
          comparison_group: {},
        });
        continue;
      }
      // peers from this session's other athletes
      const peers: number[] = [];
      for (const otherId of athleteIds) {
        if (otherId === userId) continue;
        // recompute peer's selected value for the same metric-key
        const peerAttempts: typeof allAttempts = [];
        for (const a of allAttempts ?? []) if (a.user_id === otherId) peerAttempts.push(a);
        if (m.calculation_type === "direct") {
          const testKey = (m.config as { input_metric_key?: string }).input_metric_key ?? m.key;
          const t = testByKey.get(testKey);
          if (!t) continue;
          const sel = selectPerformanceResult({
            attempts: peerAttempts.filter((a) => a.test_definition_id === t.id).map((a) => ({
              id: a.id, raw_value: Number(a.raw_value), unit_snapshot: a.unit_snapshot, valid: a.valid, measured_at: a.measured_at,
            })),
            method: (t.result_selection as ResultSelectionMethod) ?? "best",
            direction: (t.direction as Direction) ?? "higher_is_better",
            unit: t.unit,
          });
          if (sel.status === "OK" && typeof sel.selected_value === "number") peers.push(sel.selected_value);
        }
      }
      const scoreRes = calculateMetricScoreInternal({
        benchmarkModelId: internalBenchmark.id,
        benchmarkVersion: internalBenchmark.version,
        minimumSampleSize: internalBenchmark.minimum_sample_size,
        peerValues: peers,
        value,
        direction: (m.direction as Direction) ?? "higher_is_better",
        comparisonGroup: { scope: "session", session_id: session.id },
      });
      metricScoreRows.push({
        metric_definition_id: m.id,
        score: scoreRes.score,
        selected_value: value,
        unit: null,
        benchmark_model_id: scoreRes.benchmark_model_id,
        benchmark_version: scoreRes.benchmark_version,
        sample_size: scoreRes.sample_size,
        comparison_group: scoreRes.comparison_group,
      });
    }

    // 6d. Domain scores
    const scoreByMetricId = new Map(metricScoreRows.map((r) => [r.metric_definition_id, r.score]));
    const domainRows: Array<{ domain_id: string; score: number | null; coverage: number; contributing: unknown }> = [];
    for (const d of domains ?? []) {
      const metricsForDomain = (metrics ?? []).filter((m) => m.domain_id === d.id);
      const contributing = metricsForDomain.map((m) => {
        const w = (domainWeights ?? []).find((w) => w.domain_id === d.id && w.metric_definition_id === m.id);
        return {
          metric_definition_id: m.id,
          score: scoreByMetricId.get(m.id) ?? null,
          weight: w ? Number(w.weight) : 0,
          required: false,
        };
      });
      const res = calculateDomainScore({ metrics: contributing });
      domainRows.push({ domain_id: d.id, score: res.score, coverage: res.data_coverage, contributing: res.contributing });
    }

    // 6e. Position profile weights
    const { data: profileRow } = await supabase
      .from("organization_memberships")
      .select("position, team_id")
      .eq("organization_id", session.organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    let positionProfileId: string | null = null;
    let positionProfileActive = false;
    let positionWeights: Array<{ domain_id: string; weight: number }> = [];
    if (profileRow?.position) {
      const { data: posProfile } = await supabase
        .from("performance_position_profiles")
        .select("id, status")
        .eq("framework_id", framework_id)
        .eq("position_key", profileRow.position)
        .maybeSingle();
      if (posProfile) {
        positionProfileId = posProfile.id;
        positionProfileActive = posProfile.status === "active";
        const { data: pdw } = await supabase
          .from("performance_position_domain_weights")
          .select("domain_id, weight")
          .eq("position_profile_id", posProfile.id);
        positionWeights = (pdw ?? []).map((w) => ({ domain_id: w.domain_id, weight: Number(w.weight) }));
      }
    }

    // 6f. Overall
    const overall = calculateOverallPerformanceProfile({
      positionProfileActive,
      domains: domainRows.map((d) => ({
        domain_id: d.domain_id,
        score: d.score,
        weight: positionWeights.find((w) => w.domain_id === d.domain_id)?.weight ?? 0,
        coverage: d.coverage,
      })),
    });

    // 6g. Confidence
    const requiredMetrics = (metrics ?? []).length;
    const requiredWithScore = metricScoreRows.filter((r) => typeof r.score === "number").length;
    const conf = calculateProfileConfidence({
      dataCoverage: requiredMetrics === 0 ? 0 : requiredWithScore / requiredMetrics,
      requiredMetricsCoverage: requiredMetrics === 0 ? 0 : requiredWithScore / requiredMetrics,
      testRecencyDays: 0,
      retestWindowDays: battery.recommended_retest_days ?? null,
      benchmarkSampleSize: metricScoreRows[0]?.sample_size ?? null,
      benchmarkMinSampleSize: internalBenchmark?.minimum_sample_size ?? null,
      positionProfileActive,
    });

    // 7. Upsert profile
    const { data: upserted, error: pErr } = await supabase
      .from("performance_athlete_profiles")
      .upsert(
        {
          organization_id: session.organization_id,
          user_id: userId,
          framework_id,
          framework_version: framework.version,
          position_profile_id: positionProfileId,
          benchmark_model_id: internalBenchmark?.id ?? null,
          overall_score: overall.score,
          confidence: conf.level,
          data_coverage: overall.data_coverage,
          calculation_version: 1,
          missing_metrics: metricScoreRows.filter((r) => r.selected_value == null).map((r) => r.metric_definition_id),
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,framework_id" },
      )
      .select("id")
      .single();
    if (pErr || !upserted) {
      notes.push(`Profile upsert failed for ${userId}: ${pErr?.message}`);
      continue;
    }

    // 8. Metric scores upsert
    await supabase.from("performance_athlete_metric_scores").delete().eq("profile_id", upserted.id);
    if (metricScoreRows.length > 0) {
      await supabase.from("performance_athlete_metric_scores").insert(
        metricScoreRows.map((r) => ({
          profile_id: upserted.id,
          organization_id: session.organization_id,
          user_id: userId,
          metric_definition_id: r.metric_definition_id,
          selected_value: r.selected_value,
          unit: r.unit,
          score: r.score,
          benchmark_model_id: r.benchmark_model_id,
          benchmark_version: r.benchmark_version,
          comparison_group: r.comparison_group,
          sample_size: r.sample_size,
        })),
      );
    }

    // 9. Domain scores upsert
    await supabase.from("performance_athlete_domain_scores").delete().eq("profile_id", upserted.id);
    if (domainRows.length > 0) {
      await supabase.from("performance_athlete_domain_scores").insert(
        domainRows.map((d) => ({
          profile_id: upserted.id,
          organization_id: session.organization_id,
          user_id: userId,
          domain_id: d.domain_id,
          score: d.score,
          contributing_metrics: d.contributing,
        })),
      );
    }

    // 10. Focus areas — engine only replaces engine rows, coach rows preserved.
    const focus = deriveDevelopmentFocusAreas({
      domains: domainRows.map((d) => ({
        domain_id: d.domain_id,
        domain_name: domainById.get(d.domain_id)?.name ?? "",
        score: d.score,
        coverage: d.coverage,
        position_weight: positionWeights.find((w) => w.domain_id === d.domain_id)?.weight ?? 0,
        trend: null,
      })),
      coachOverrides: [],
    });
    await supabase
      .from("performance_athlete_focus_areas")
      .delete()
      .eq("organization_id", session.organization_id)
      .eq("user_id", userId)
      .eq("framework_id", framework_id)
      .eq("source", "engine");
    if (focus.engine.length > 0) {
      await supabase.from("performance_athlete_focus_areas").insert(
        focus.engine.map((f) => ({
          organization_id: session.organization_id,
          user_id: userId,
          framework_id,
          domain_id: f.domain_id,
          label: f.label,
          rationale: f.reason_codes.join(", "),
          priority: f.priority,
          source: "engine",
          status: "suggested",
        })),
      );
    }

    // 11. Retest schedule
    for (const t of tests ?? []) {
      const nextDue = calculateRetestDue({
        lastTestedAt: session.test_date,
        testRecommendedDays: t.recommended_retest_days ?? null,
        batteryRecommendedDays: battery.recommended_retest_days ?? null,
      });
      if (!nextDue) continue;
      await supabase.from("performance_retest_schedule").upsert(
        {
          organization_id: session.organization_id,
          user_id: userId,
          battery_id: battery.id,
          test_definition_id: t.id,
          last_tested_at: session.test_date,
          next_retest_due: nextDue,
          auto_created: true,
        },
        { onConflict: "organization_id,user_id,test_definition_id" as unknown as string },
      );
    }

    profilesUpdated++;
  }

  return { profiles_updated: profilesUpdated, notes };
}

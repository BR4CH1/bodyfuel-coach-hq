/**
 * Player Cards — Server functions (Phase 1).
 *
 * - recomputePlayerCard  → BFR aus verifizierten Tests neu berechnen und in
 *   `player_cards` upserten + Snapshot in `player_card_history`.
 * - getMyPlayerCard      → aktuelle Karte + History für den eingeloggten User.
 * - getPlayerCardForAthlete → gleiche Daten für einen anderen Athleten
 *   (Coach/Org-Staff via assertCoachOrOrgStaffForAthlete).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  computePlayerCard,
  type Benchmark,
  type PositionWeights,
  type MetricInput,
} from "./player-cards/engine";
import { assertCoachOrOrgStaffForAthlete, isGlobalCoach } from "@/lib/organizations/org-coach-access";

const FOOTBALL_POSITION_ALIASES: Record<string, string> = {
  qb: "QB",
  quarterback: "QB",
  rb: "RB",
  runningback: "RB",
  "running back": "RB",
  wr: "WR",
  widereceiver: "WR",
  "wide receiver": "WR",
  te: "TE",
  tightend: "TE",
  "tight end": "TE",
  ol: "OL",
  offensiveline: "OL",
  "offensive line": "OL",
  dl: "DL",
  defensiveline: "DL",
  "defensive line": "DL",
  lb: "LB",
  linebacker: "LB",
  cb: "CB",
  cornerback: "CB",
  s: "S",
  safety: "S",
};

function normalizeFootballPosition(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return FOOTBALL_POSITION_ALIASES[key] ?? raw.toUpperCase();
}

/**
 * Baut das MetricInput-Array aus verifizierten Bulls-Performance-Tests.
 * Wir nehmen jeweils den BESTEN Wert pro Metrik.
 */
function buildMetricInputs(
  verifiedTests: Array<{
    test_id: string;
    result_value: number;
    bodyweight_kg: number | null;
    performed_at: string;
  }>,
): MetricInput[] {
  // Bulls-Test-IDs entsprechen direkt den metric_keys der Benchmarks.
  const bestPerMetric = new Map<string, MetricInput>();

  for (const t of verifiedTests) {
    const inputs: MetricInput[] = [];
    if (t.test_id === "a505_left" || t.test_id === "a505_right") {
      // AGI kombiniert links+rechts als Mittelwert (a505_avg).
      inputs.push({
        metric_key: t.test_id,
        value: Number(t.result_value),
        measured_at: t.performed_at,
      });
    } else {
      inputs.push({
        metric_key: t.test_id,
        value: Number(t.result_value),
        bodyweight_kg: t.bodyweight_kg ?? null,
        measured_at: t.performed_at,
      });
    }

    for (const input of inputs) {
      const existing = bestPerMetric.get(input.metric_key);
      if (!existing) {
        bestPerMetric.set(input.metric_key, input);
        continue;
      }
      // Bester Wert je nach Metrik: bei den Zeitmetriken (a505, sprint) niedriger, sonst höher.
      const lowerBetter = /^sprint_|^a505_|^rast_/.test(input.metric_key);
      if (
        (lowerBetter && input.value < existing.value) ||
        (!lowerBetter && input.value > existing.value)
      ) {
        bestPerMetric.set(input.metric_key, input);
      }
    }
  }

  const arr = Array.from(bestPerMetric.values());

  // AGI-Mittelwert `a505_avg` synthetisieren, wenn beide Seiten vorhanden.
  const left = arr.find((a) => a.metric_key === "a505_left");
  const right = arr.find((a) => a.metric_key === "a505_right");
  if (left && right) {
    arr.push({
      metric_key: "a505_avg",
      value: (left.value + right.value) / 2,
      measured_at: left.measured_at ?? right.measured_at,
    });
  } else if (left || right) {
    const single = (left ?? right)!;
    arr.push({ metric_key: "a505_avg", value: single.value, measured_at: single.measured_at });
  }

  return arr;
}

/** Kernberechnung — für interne Wiederverwendung (Coach recompute). */
async function doRecompute(supabase: any, targetUserId: string) {
  // 1) Profil-Daten laden (Position, Org-Zugehörigkeit) — sowohl bulls_profiles als auch memberships.
  const [bullsProfileRes, membershipsRes, latestBodyRes] = await Promise.all([
    supabase.from("bulls_profiles").select("position, weight_kg").eq("user_id", targetUserId).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, status")
      .eq("user_id", targetUserId)
      .eq("role", "athlete")
      .eq("status", "active")
      .limit(1),
    supabase
      .from("body_measurements")
      .select("weight_kg, recorded_at")
      .eq("user_id", targetUserId)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);

  const rawPosition = bullsProfileRes.data?.position ?? null;
  const organizationId = membershipsRes.data?.[0]?.organization_id ?? null;
  const fallbackBodyweight =
    Number(bullsProfileRes.data?.weight_kg) || Number(latestBodyRes.data?.[0]?.weight_kg) || null;

  const positionKey = normalizeFootballPosition(rawPosition);

  // 2) Gewichtung + Benchmarks laden.
  const sport = "football";
  const [weightsRes, benchRes] = await Promise.all([
    supabase
      .from("player_card_position_weights")
      .select("*")
      .eq("sport", sport)
      .eq("position_key", positionKey ?? "QB") // Fallback QB, damit wenigstens ein Vorläufig-BFR rauskommt
      .maybeSingle(),
    supabase.from("player_card_benchmarks").select("*").eq("sport", sport),
  ]);

  const weights = (weightsRes.data ?? {
    sport,
    position_key: positionKey ?? "QB",
    label: positionKey ?? "Quarterback",
    w_spd: 0.2,
    w_acc: 0.2,
    w_agi: 0.2,
    w_pow: 0.15,
    w_str: 0.15,
    w_end: 0.1,
  }) as PositionWeights;

  const benchmarks = (benchRes.data ?? []) as Benchmark[];

  // 3) Verifizierte Bulls-Performance-Tests laden.
  const { data: testsData } = await supabase
    .from("bulls_performance_tests")
    .select("test_id, result_value, bodyweight_kg, performed_at")
    .eq("user_id", targetUserId)
    .eq("verification_status", "verified");

  const rawTests = (testsData ?? []) as Array<{
    test_id: string;
    result_value: number;
    bodyweight_kg: number | null;
    performed_at: string;
  }>;

  // Fallback-Bodyweight, falls einzelne Tests kein bodyweight_kg gespeichert haben.
  const tests = rawTests.map((t) => ({
    ...t,
    bodyweight_kg: t.bodyweight_kg ?? fallbackBodyweight,
  }));

  const inputs = buildMetricInputs(tests);
  const result = computePlayerCard(weights, benchmarks, inputs);

  // 4) Upsert via Service-Role.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const payload = {
    user_id: targetUserId,
    organization_id: organizationId,
    sport,
    position_key: positionKey,
    bfr: result.bfr,
    spd: result.attributes.SPD.score,
    acc: result.attributes.ACC.score,
    agi: result.attributes.AGI.score,
    pow: result.attributes.POW.score,
    str: result.attributes.STR.score,
    end_score: result.attributes.END.score,
    tier: result.tier,
    is_provisional: result.isProvisional,
    missing_tests: result.missingTests,
    attributes_detail: result.attributes,
    strongest_attribute: result.strongestAttribute,
    computed_at: new Date().toISOString(),
  };

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from("player_cards")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (upsertError) throw new Error(upsertError.message);

  await supabaseAdmin.from("player_card_history").insert({
    user_id: targetUserId,
    organization_id: organizationId,
    sport,
    position_key: positionKey,
    bfr: result.bfr,
    spd: result.attributes.SPD.score,
    acc: result.attributes.ACC.score,
    agi: result.attributes.AGI.score,
    pow: result.attributes.POW.score,
    str: result.attributes.STR.score,
    end_score: result.attributes.END.score,
    tier: result.tier,
    is_provisional: result.isProvisional,
    attributes_detail: result.attributes,
  });

  return upserted;
}

/** Karte für sich selbst oder — mit Coach-Rechten — für einen anderen Athleten neu berechnen. */
export const recomputePlayerCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid().optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id ?? userId;
    if (target !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, target, "athlete");
    }
    return await doRecompute(supabase, target);
  });

async function loadCardBundle(supabase: any, targetUserId: string) {
  const [cardRes, historyRes, profileRes, bullsRes, testsRes] = await Promise.all([
    supabase.from("player_cards").select("*").eq("user_id", targetUserId).maybeSingle(),
    supabase
      .from("player_card_history")
      .select("bfr, spd, acc, agi, pow, str, end_score, snapshot_at, tier, is_provisional")
      .eq("user_id", targetUserId)
      .order("snapshot_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("display_name, nickname, avatar_url, birthdate, height_cm, sport_position")
      .eq("id", targetUserId)
      .maybeSingle(),
    supabase
      .from("bulls_profiles")
      .select("first_name, last_name, weight_kg, height_cm, position")
      .eq("user_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("bulls_performance_tests")
      .select("test_id, result_value, result_unit, performed_at, verification_status")
      .eq("user_id", targetUserId)
      .eq("verification_status", "verified")
      .order("performed_at", { ascending: false }),
  ]);

  let organization = null as null | {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    background_color: string | null;
    text_color: string | null;
    claim: string | null;
    short_name: string | null;
  };
  if (cardRes.data?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, logo_url, primary_color, secondary_color, accent_color, background_color, text_color, claim, short_name")
      .eq("id", cardRes.data.organization_id)
      .maybeSingle();
    organization = (org ?? null) as any;
  }

  return {
    card: cardRes.data ?? null,
    history: (historyRes.data ?? []).slice().reverse(),
    profile: profileRes.data ?? null,
    bullsProfile: bullsRes.data ?? null,
    verifiedTests: testsRes.data ?? [],
    organization,
  };
}

export const getMyPlayerCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await loadCardBundle(context.supabase, context.userId);
  });

export const getPlayerCardForAthlete = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "athlete");
    }
    return await loadCardBundle(context.supabase, data.user_id);
  });

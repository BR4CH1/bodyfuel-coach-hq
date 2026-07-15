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
import { evaluateAllBadges, type BadgeDefinition } from "./player-cards/badges";

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

  // Vorherige Karte laden (für Tier-Upgrade-Detection).
  const { data: previousCard } = await supabaseAdmin
    .from("player_cards")
    .select("bfr, tier")
    .eq("user_id", targetUserId)
    .maybeSingle();

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

  // 5) Badge-Auswertung. Nur neue Unlocks werden angelegt (UNIQUE user_id+badge_key).
  const [{ data: defsData }, { data: historyData }] = await Promise.all([
    supabaseAdmin.from("player_card_badge_definitions").select("*").eq("sport", sport),
    supabaseAdmin
      .from("player_card_history")
      .select("bfr, snapshot_at")
      .eq("user_id", targetUserId),
  ]);
  const defs = ((defsData ?? []) as unknown) as BadgeDefinition[];
  const history = (historyData ?? []) as Array<{ bfr: number | null; snapshot_at: string }>;
  const cardForBadges = {
    bfr: result.bfr,
    spd: result.attributes.SPD.score,
    acc: result.attributes.ACC.score,
    agi: result.attributes.AGI.score,
    pow: result.attributes.POW.score,
    str: result.attributes.STR.score,
    end_score: result.attributes.END.score,
  };
  const unlockedKeys = evaluateAllBadges(defs, cardForBadges, history);
  if (unlockedKeys.length > 0) {
    const rows = unlockedKeys.map((key) => ({
      user_id: targetUserId,
      badge_key: key,
      organization_id: organizationId,
      snapshot_bfr: result.bfr,
    }));
    // ON CONFLICT ignore — nur neue Unlocks landen.
    await supabaseAdmin
      .from("player_card_badge_unlocks")
      .upsert(rows, { onConflict: "user_id,badge_key", ignoreDuplicates: true });
  }

  const TIER_ORDER = ["bronze", "silver", "gold", "elite", "legendary"] as const;
  const prevIdx = previousCard?.tier ? TIER_ORDER.indexOf(previousCard.tier as any) : -1;
  const newIdx = TIER_ORDER.indexOf(result.tier as any);
  const upgrade =
    previousCard && newIdx > prevIdx && prevIdx >= 0
      ? {
          previous_tier: previousCard.tier as string,
          new_tier: result.tier,
          previous_bfr: Number(previousCard.bfr ?? 0),
          new_bfr: result.bfr,
        }
      : null;

  return { card: upserted, upgrade, newly_unlocked_badges: unlockedKeys };
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
  const [cardRes, historyRes, profileRes, bullsRes, testsRes, unlocksRes, defsRes] = await Promise.all([
    supabase.from("player_cards").select("*").eq("user_id", targetUserId).maybeSingle(),
    supabase
      .from("player_card_history")
      .select("bfr, spd, acc, agi, pow, str, end_score, snapshot_at, tier, is_provisional")
      .eq("user_id", targetUserId)
      .order("snapshot_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("display_name, nickname, avatar_url, avatar_cutout_url, avatar_cutout_source, birthdate, height_cm, sport_position")
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
    supabase
      .from("player_card_badge_unlocks")
      .select("badge_key, unlocked_at, seen_at, snapshot_bfr")
      .eq("user_id", targetUserId)
      .order("unlocked_at", { ascending: false }),
    supabase
      .from("player_card_badge_definitions")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  let organization = null as null | {
    id: string;
    name: string;
    slug: string | null;
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
      .select("id, name, slug, logo_url, primary_color, secondary_color, accent_color, background_color, text_color, claim, short_name")
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
    badges: {
      definitions: (defsRes.data ?? []) as any[],
      unlocks: (unlocksRes.data ?? []) as any[],
    },
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

/** Markiert Badge-Unlocks als gesehen — schaltet die "Neu"-Animation aus. */
export const markBadgeUnlocksSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ badge_keys: z.array(z.string()).optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("player_card_badge_unlocks")
      .update({ seen_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("seen_at", null);
    if (data.badge_keys && data.badge_keys.length) q = q.in("badge_key", data.badge_keys);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * listCoachPlayerCards — alle Player Cards, auf die der aufrufende
 * Coach/Org-Staff Zugriff hat.
 *
 * Zugriffsregeln:
 *  - Global-Coach (public.has_role('coach'))                    → alle Karten
 *  - Sonst: alle Karten aus Orgs, in denen der Aufrufer
 *      • Membership mit Rolle 'organization_admin' hat, ODER
 *      • einen staff_assignments-Eintrag mit Rolle 'coach' oder
 *        'organization_admin' hat.
 * Ergebnis enthält für jede Karte den Athletennamen, Foto, Position,
 * Teamzugehörigkeit sowie das Organisations-Branding — damit die Grid-
 * Anzeige und der PNG-Export ohne weitere Roundtrips klappen.
 */
export const listCoachPlayerCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const globalCoach = await isGlobalCoach(supabase, userId);

    // Orgs bestimmen, die der Aufrufer sehen darf.
    let allowedOrgIds: string[] | null = null; // null == alle
    if (!globalCoach) {
      const [{ data: memberships }, { data: staff }] = await Promise.all([
        supabaseAdmin
          .from("organization_memberships")
          .select("organization_id, role, status")
          .eq("user_id", userId)
          .eq("status", "active")
          .in("role", ["organization_admin"]),
        supabaseAdmin
          .from("staff_assignments")
          .select("organization_id, role")
          .eq("user_id", userId)
          .in("role", ["coach", "organization_admin"]),
      ]);
      const orgIds = new Set<string>();
      for (const m of (memberships ?? []) as any[]) if (m.organization_id) orgIds.add(m.organization_id);
      for (const s of (staff ?? []) as any[]) if (s.organization_id) orgIds.add(s.organization_id);
      if (orgIds.size === 0) {
        return { cards: [], organizations: [] as any[] };
      }
      allowedOrgIds = Array.from(orgIds);
    }

    let cardsQuery = supabaseAdmin
      .from("player_cards")
      .select("*")
      .order("bfr", { ascending: false, nullsFirst: false });
    if (allowedOrgIds) cardsQuery = cardsQuery.in("organization_id", allowedOrgIds);

    const { data: cards, error } = await cardsQuery;
    if (error) throw new Error(error.message);
    const cardRows = (cards ?? []) as any[];
    if (cardRows.length === 0) return { cards: [], organizations: [] };

    const userIds = Array.from(new Set(cardRows.map((c) => c.user_id).filter(Boolean)));
    const orgIds = Array.from(new Set(cardRows.map((c) => c.organization_id).filter(Boolean)));

    const [profilesRes, bullsRes, orgsRes, membershipRes, teamsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, nickname, avatar_url, birthdate, height_cm, sport_position")
        .in("id", userIds),
      supabaseAdmin
        .from("bulls_profiles")
        .select("user_id, first_name, last_name, weight_kg, height_cm, position")
        .in("user_id", userIds),
      orgIds.length
        ? supabaseAdmin
            .from("organizations")
            .select("id, name, logo_url, primary_color, secondary_color, accent_color, background_color, text_color, claim, short_name, slug")
            .in("id", orgIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin
        .from("team_memberships")
        .select("user_id, team_id, jersey_number")
        .in("user_id", userIds),
      supabaseAdmin
        .from("organization_teams")
        .select("id, name, organization_id")
        .in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const profilesById = new Map<string, any>();
    for (const p of (profilesRes.data ?? []) as any[]) profilesById.set(p.id, p);
    const bullsById = new Map<string, any>();
    for (const b of (bullsRes.data ?? []) as any[]) bullsById.set(b.user_id, b);
    const orgsById = new Map<string, any>();
    for (const o of (orgsRes.data ?? []) as any[]) orgsById.set(o.id, o);
    const teamsById = new Map<string, any>();
    for (const t of (teamsRes.data ?? []) as any[]) teamsById.set(t.id, t);
    const membershipByUser = new Map<string, any>();
    for (const m of (membershipRes.data ?? []) as any[]) {
      // Erste Membership pro User reicht für Team-Label/Trikot.
      if (!membershipByUser.has(m.user_id)) membershipByUser.set(m.user_id, m);
    }

    const enriched = cardRows.map((card) => {
      const member = membershipByUser.get(card.user_id);
      const team = member?.team_id ? teamsById.get(member.team_id) : null;
      return {
        card,
        profile: profilesById.get(card.user_id) ?? null,
        bullsProfile: bullsById.get(card.user_id) ?? null,
        organization: card.organization_id ? orgsById.get(card.organization_id) ?? null : null,
        teamId: team?.id ?? null,
        teamName: team?.name ?? null,
        jerseyNumber: member?.jersey_number ?? null,
      };
    });

    return {
      cards: enriched,
      organizations: Array.from(orgsById.values()),
    };
  });


// ============================================================
// Phase 4 — Ranking, Player of the Month, Hall of Fame
// ============================================================

async function assertOrgAccess(supabase: any, userId: string, orgId: string): Promise<"staff" | "member"> {
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (staff) return "staff";
  if (await isGlobalCoach(supabase, userId)) return "staff";
  const { data: mem } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) throw new Error("Kein Zugriff auf diese Organisation.");
  return "member";
}

/** Rangliste einer Organisation, optional gefiltert nach Team. */
export const getPlayerCardRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id?: string | null; limit?: number }) => ({
    organization_id: String(d.organization_id),
    team_id: d.team_id ? String(d.team_id) : null,
    limit: Math.min(Math.max(Number(d.limit ?? 100), 1), 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const { data: rows, error } = await supabase.rpc("get_player_card_ranking" as any, {
      _organization_id: data.organization_id,
      _team_id: data.team_id,
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);

    const { data: teams } = await supabase
      .from("organization_teams")
      .select("id, name")
      .eq("organization_id", data.organization_id)
      .order("name");

    return {
      rows: (rows ?? []) as any[],
      teams: (teams ?? []) as any[],
      viewerUserId: userId,
    };
  });

function currentYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Kandidaten für "Player of the Month" — sortiert nach BFR-Delta im Monat. */
export const getPlayerOfTheMonthCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; year?: number; month?: number }) => {
    const fb = currentYearMonth();
    return {
      organization_id: String(d.organization_id),
      year: Number.isFinite(d.year) ? Number(d.year) : fb.year,
      month: Number.isFinite(d.month) ? Number(d.month) : fb.month,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const { data: rows, error } = await supabase.rpc("get_player_card_month_candidates" as any, {
      _organization_id: data.organization_id,
      _year: data.year,
      _month: data.month,
    });
    if (error) throw new Error(error.message);

    const { data: existing } = await supabase
      .from("player_card_monthly_awards")
      .select("id, user_id, award_kind, bfr_at_award, bfr_delta, team_id, finalized_by, created_at")
      .eq("organization_id", data.organization_id)
      .eq("year", data.year)
      .eq("month", data.month);

    return {
      year: data.year,
      month: data.month,
      candidates: (rows ?? []) as any[],
      awards: (existing ?? []) as any[],
    };
  });

/** Team of the Month — durchschnittliches BFR-Delta pro Team im Monat. */
export const getTeamOfTheMonthCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; year?: number; month?: number }) => {
    const fb = currentYearMonth();
    return {
      organization_id: String(d.organization_id),
      year: Number.isFinite(d.year) ? Number(d.year) : fb.year,
      month: Number.isFinite(d.month) ? Number(d.month) : fb.month,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const monthStart = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const { data: rows, error } = await supabase.rpc(
      "get_team_of_the_month_candidates" as any,
      { _organization_id: data.organization_id, _month_start: monthStart },
    );
    if (error) throw new Error(error.message);
    return {
      year: data.year,
      month: data.month,
      candidates: (rows ?? []) as any[],
    };
  });



/** Coach setzt Player of the Month für einen Monat (award_kind: top_bfr | top_delta). */
export const finalizePlayerOfTheMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    year: number;
    month: number;
    user_id: string;
    award_kind?: "top_bfr" | "top_delta";
    team_id?: string | null;
    bfr_at_award: number;
    bfr_delta: number;
  }) => ({
    organization_id: String(d.organization_id),
    year: Number(d.year),
    month: Number(d.month),
    user_id: String(d.user_id),
    award_kind: (d.award_kind ?? "top_bfr") as "top_bfr" | "top_delta",
    team_id: d.team_id ? String(d.team_id) : null,
    bfr_at_award: Math.round(Number(d.bfr_at_award)),
    bfr_delta: Math.round(Number(d.bfr_delta)),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await assertOrgAccess(supabase, userId, data.organization_id);
    if (role !== "staff") throw new Error("Nur Coach oder Org-Admin darf Auszeichnungen setzen.");
    const { error } = await supabase
      .from("player_card_monthly_awards")
      .upsert(
        {
          organization_id: data.organization_id,
          team_id: data.team_id,
          year: data.year,
          month: data.month,
          user_id: data.user_id,
          award_kind: data.award_kind,
          bfr_at_award: data.bfr_at_award,
          bfr_delta: data.bfr_delta,
          finalized_by: userId,
        },
        { onConflict: "organization_id,team_id,year,month,award_kind" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hall of Fame — vergangene Auszeichnungen. */
export const getPlayerCardHallOfFame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; limit?: number }) => ({
    organization_id: String(d.organization_id),
    limit: Math.min(Math.max(Number(d.limit ?? 24), 1), 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const { data: rows, error } = await supabase
      .from("player_card_monthly_awards")
      .select("id, year, month, user_id, award_kind, bfr_at_award, bfr_delta, team_id, created_at")
      .eq("organization_id", data.organization_id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const teamIds = Array.from(new Set((rows ?? []).map((r: any) => r.team_id).filter(Boolean)));
    const [profilesRes, teamsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, display_name, nickname, avatar_url").in("id", userIds)
        : Promise.resolve({ data: [] }),
      teamIds.length
        ? supabase.from("organization_teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] }),
    ]);
    const profilesById = new Map<string, any>();
    for (const p of (profilesRes.data ?? []) as any[]) profilesById.set(p.id, p);
    const teamsById = new Map<string, any>();
    for (const t of (teamsRes.data ?? []) as any[]) teamsById.set(t.id, t);

    return {
      awards: (rows ?? []).map((r: any) => ({
        ...r,
        profile: profilesById.get(r.user_id) ?? null,
        team: r.team_id ? teamsById.get(r.team_id) ?? null : null,
      })),
    };
  });


// ============================================================
// Phase 5 — Admin editor (position weights & benchmarks)
// ============================================================

async function assertPlatformOwner(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nur Plattform-Administratoren dürfen Player-Card-Regeln bearbeiten.");
}

/** Alle Positionsgewichtungen (öffentlich lesbar für alle authenticated). */
export const listPlayerCardPositionWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sport?: string }) => ({ sport: d?.sport ?? null }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("player_card_position_weights").select("*").order("sport").order("position_key");
    if (data.sport) q = q.eq("sport", data.sport);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

/** Alle Benchmark-Definitionen. */
export const listPlayerCardBenchmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sport?: string }) => ({ sport: d?.sport ?? null }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("player_card_benchmarks").select("*").order("sport").order("attribute_key").order("metric_key");
    if (data.sport) q = q.eq("sport", data.sport);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

/** Position anlegen oder aktualisieren. Gewichtungen werden auf Summe 1 normalisiert. */
export const upsertPlayerCardPositionWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string | null;
    sport: string;
    position_key: string;
    label: string;
    w_spd: number; w_acc: number; w_agi: number; w_pow: number; w_str: number; w_end: number;
  }) => ({
    id: d.id ?? null,
    sport: String(d.sport).trim(),
    position_key: String(d.position_key).trim().toUpperCase(),
    label: String(d.label).trim(),
    w_spd: Number(d.w_spd),
    w_acc: Number(d.w_acc),
    w_agi: Number(d.w_agi),
    w_pow: Number(d.w_pow),
    w_str: Number(d.w_str),
    w_end: Number(d.w_end),
  }))
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);
    if (!data.sport || !data.position_key || !data.label) throw new Error("Sport, Position und Label sind erforderlich.");
    const sum = data.w_spd + data.w_acc + data.w_agi + data.w_pow + data.w_str + data.w_end;
    if (!(sum > 0)) throw new Error("Mindestens eine Gewichtung > 0 setzen.");
    const norm = (v: number) => Number((v / sum).toFixed(4));
    const payload = {
      sport: data.sport,
      position_key: data.position_key,
      label: data.label,
      w_spd: norm(data.w_spd),
      w_acc: norm(data.w_acc),
      w_agi: norm(data.w_agi),
      w_pow: norm(data.w_pow),
      w_str: norm(data.w_str),
      w_end: norm(data.w_end),
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("player_card_position_weights")
        .update(payload as any)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("player_card_position_weights")
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as any).id };
  });

export const deletePlayerCardPositionWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("player_card_position_weights")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Benchmark-Kurve upserten. Ankerpunkte werden nach `value` sortiert. */
export const upsertPlayerCardBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string | null;
    sport: string;
    attribute_key: string;
    metric_key: string;
    direction: "higher_is_better" | "lower_is_better";
    weight: number;
    anchors: Array<{ value: number; score: number }>;
  }) => ({
    id: d.id ?? null,
    sport: String(d.sport).trim(),
    attribute_key: String(d.attribute_key).trim().toUpperCase(),
    metric_key: String(d.metric_key).trim(),
    direction: d.direction === "lower_is_better" ? "lower_is_better" : "higher_is_better",
    weight: Number(d.weight),
    anchors: Array.isArray(d.anchors) ? d.anchors.map((a) => ({ value: Number(a.value), score: Number(a.score) })) : [],
  }))
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);
    if (!data.sport || !data.metric_key || !data.attribute_key) throw new Error("Sport, Attribut und Metrik sind erforderlich.");
    if (data.anchors.length < 2) throw new Error("Mindestens zwei Ankerpunkte erforderlich.");
    const anchors = [...data.anchors].sort((a, b) => a.value - b.value);
    for (const a of anchors) {
      if (!Number.isFinite(a.value) || !Number.isFinite(a.score)) throw new Error("Alle Ankerpunkte müssen numerisch sein.");
      if (a.score < 0 || a.score > 99) throw new Error("Score muss zwischen 0 und 99 liegen.");
    }
    const payload = {
      sport: data.sport,
      attribute_key: data.attribute_key,
      metric_key: data.metric_key,
      direction: data.direction,
      weight: data.weight,
      anchors,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("player_card_benchmarks")
        .update(payload as any)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("player_card_benchmarks")
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as any).id };
  });

export const deletePlayerCardBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("player_card_benchmarks")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * ensurePlayerCardCutout — stellt sicher, dass für die Player Card ein
 * transparent freigestelltes PNG-Foto existiert. Wird idempotent bei jedem
 * Kartenaufruf ausgelöst (siehe PlayerCardSection).
 *
 * Ablauf:
 *  1. Profil laden. Wenn `avatar_cutout_url` bereits zu `avatar_url` passt → nichts tun.
 *  2. Original-Foto aus Storage laden (private avatars-Bucket).
 *  3. Über Lovable AI Gateway (Gemini 2.5 Flash Image) freistellen — Prompt: nur der Spieler, transparenter Hintergrund.
 *  4. Ergebnis als PNG in `avatars/{userId}/cutouts/{ts}.png` speichern.
 *  5. `profiles.avatar_cutout_url` + `avatar_cutout_source` aktualisieren.
 */
export const ensurePlayerCardCutout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid().optional(), force: z.boolean().optional() }).parse)
  .handler(async ({ data, context }) => {
    const targetUserId = data.user_id ?? context.userId;
    if (targetUserId !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, targetUserId, "athlete");
    }
    const force = !!data.force;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url, avatar_cutout_url, avatar_cutout_source")
      .eq("id", targetUserId)
      .maybeSingle();
    const rawAvatar = (profile as any)?.avatar_url as string | null | undefined;
    if (!rawAvatar) return { status: "no-source" as const };

    if (
      !force &&
      (profile as any)?.avatar_cutout_url &&
      (profile as any)?.avatar_cutout_source === rawAvatar
    ) {
      return { status: "cached" as const, cutout_url: (profile as any).avatar_cutout_url as string };
    }

    // 1) Original-Bytes laden.
    let inputBase64: string | null = null;
    let inputMime = "image/jpeg";
    if (/^(https?:|data:)/i.test(rawAvatar)) {
      const res = await fetch(rawAvatar);
      if (!res.ok) throw new Error(`Original-Foto nicht abrufbar (${res.status})`);
      inputMime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      const buf = new Uint8Array(await res.arrayBuffer());
      inputBase64 = Buffer.from(buf).toString("base64");
    } else {
      const { data: dl, error: dlErr } = await supabaseAdmin.storage
        .from("avatars")
        .download(rawAvatar);
      if (dlErr || !dl) throw new Error(dlErr?.message ?? "Original-Foto nicht in Storage gefunden");
      inputMime = dl.type || "image/jpeg";
      const buf = new Uint8Array(await dl.arrayBuffer());
      inputBase64 = Buffer.from(buf).toString("base64");
    }

    // 2) Gemini Image Gen — Freistellen mit transparentem Hintergrund.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Cut out the athlete/person from this photo. Place the isolated subject on a completely solid pure white (#FFFFFF) background — no gradients, no shadow, no ground, no floor, no other elements. Keep the subject sharp with clean edges (hair, helmet, ball, equipment). Do not add text, borders, logos or effects. Preserve original pose, colors, and lighting on the subject.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${inputMime};base64,${inputBase64}` },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!gwRes.ok) {
      const errBody = await gwRes.text().catch(() => "");
      throw new Error(`Bildfreistellung fehlgeschlagen [${gwRes.status}]: ${errBody}`);
    }
    const gwJson = (await gwRes.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = gwJson.data?.[0]?.b64_json;
    if (!b64) throw new Error("Kein Bild in der AI-Antwort");

    // 3) Weißen Hintergrund in Alpha umwandeln (Chroma-Key).
    const rawPng = Buffer.from(b64, "base64");
    const UPNG = ((await import("upng-js")) as any).default ?? (await import("upng-js"));
    const decoded = UPNG.decode(rawPng);
    const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
    const w = decoded.width;
    const h = decoded.height;

    const HARD = 238;
    const SOFT = 205;
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i];
      const g = rgba[i + 1];
      const bl = rgba[i + 2];
      const minC = Math.min(r, g, bl);
      const maxC = Math.max(r, g, bl);
      const isNeutral = maxC - minC < 18;
      if (isNeutral && minC >= HARD) {
        rgba[i + 3] = 0;
      } else if (isNeutral && minC >= SOFT) {
        const t = (minC - SOFT) / (HARD - SOFT);
        rgba[i + 3] = Math.round((1 - t) * rgba[i + 3]);
      }
    }
    const outPng = UPNG.encode([rgba.buffer], w, h, 0);
    const outBuf = Buffer.from(new Uint8Array(outPng));
    const path = `${targetUserId}/cutouts/${Date.now()}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, outBuf, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);

    // 4) Profil aktualisieren.
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_cutout_url: path, avatar_cutout_source: rawAvatar })
      .eq("id", targetUserId);
    if (profErr) throw new Error(profErr.message);

    return { status: "generated" as const, cutout_url: path };
  });

/**
 * savePlayerCardManualOverrides — Coach/Org-Staff darf die Werte einer
 * Player Card manuell eintragen (BFR, SPD, ACC, AGI, POW, STR, END) und
 * die Karte für den Athleten freigeben (is_published).
 *
 * Werte werden in `manual_overrides` gespeichert und in der Anzeige über
 * die berechneten Werte gelegt (siehe PlayerCardSection / CoachPlayerCardView).
 */
const OverrideNumber = z.union([z.number().int().min(0).max(99), z.null()]).optional();
export const savePlayerCardManualOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      overrides: z.object({
        BFR: OverrideNumber,
        SPD: OverrideNumber,
        ACC: OverrideNumber,
        AGI: OverrideNumber,
        POW: OverrideNumber,
        STR: OverrideNumber,
        END: OverrideNumber,
      }).partial(),
      is_published: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "athlete");
    }
    // Karte existiert?
    const { data: existing } = await supabase
      .from("player_cards")
      .select("id, manual_overrides")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const mergedOverrides: Record<string, number | null> = {
      ...((existing?.manual_overrides as Record<string, number | null>) ?? {}),
      ...(data.overrides as Record<string, number | null>),
    };
    // Null-Einträge entfernen, damit "leer" wirklich leer ist.
    for (const k of Object.keys(mergedOverrides)) {
      if (mergedOverrides[k] === null || mergedOverrides[k] === undefined) delete mergedOverrides[k];
    }

    if (existing) {
      const patch: { manual_overrides: Record<string, number | null>; updated_at: string; is_published?: boolean } = {
        manual_overrides: mergedOverrides,
        updated_at: new Date().toISOString(),
      };
      if (typeof data.is_published === "boolean") patch.is_published = data.is_published;
      const { error } = await supabase.from("player_cards").update(patch).eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("player_cards").insert({
        user_id: data.user_id,
        manual_overrides: mergedOverrides,
        is_published: data.is_published ?? false,
        is_provisional: true,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true, overrides: mergedOverrides };
  });

/**
 * saveCustomPlayerCardImage — Coach/Org-Staff speichert (oder löscht) den
 * Storage-Pfad zu einem hochgeladenen fertigen Karten-Bild für einen Athleten.
 * Pfad-Konvention: "<athlete_user_id>/<filename>" im Bucket "player-card-images".
 */
export const saveCustomPlayerCardImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      storage_path: z.string().nullable(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "athlete");
    }
    const { data: existing } = await supabase
      .from("player_cards")
      .select("id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("player_cards")
        .update({ custom_card_image_url: data.storage_path, updated_at: new Date().toISOString() } as any)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("player_cards").insert({
        user_id: data.user_id,
        custom_card_image_url: data.storage_path,
        is_provisional: true,
        is_published: true,
      } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true, storage_path: data.storage_path };
  });


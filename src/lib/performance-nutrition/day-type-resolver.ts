/**
 * BodyFuel Performance Nutrition — Central Day Type Resolver (Phase 2c)
 *
 * SINGLE SOURCE OF TRUTH for "which Performance Day Type applies to (user,
 * date) in the Bulls / Performance context?". All Performance/Bulls reads
 * (nutrition targets, plan view, coach read view) MUST resolve the day type
 * through this module rather than reading `day_type_overrides` directly.
 *
 * FIVE VALID PERFORMANCE DAY TYPES:
 *   rest · strength · football_training · game_day · double_session
 *
 * PRIORITY (highest → lowest):
 *   1. Manual Bulls day-type override with a REAL performance day type
 *      (legacy "training" / non-perf values from personal writers are ignored)
 *   2. DOUBLE_SESSION  — ≥ 2 relevant structural sessions on the same date
 *      (e.g. team football training + individual strength session)
 *   3. GAME_DAY        — bulls_hub_events records a game/match on that date
 *   4. FOOTBALL_TRAINING — active team football session on that weekday
 *   5. STRENGTH        — individual/assigned strength session on that weekday
 *   6. REST            — no relevant session
 *
 * LEGACY BEHAVIOUR:
 *   Legacy personal writers still upsert kind="training"/"rest" into the
 *   shared `day_type_overrides` table. In the Performance context "training"
 *   is AMBIGUOUS and is never silently mapped to football_training or
 *   strength. Legacy "training" is dropped and surfaced through the
 *   `LEGACY_TRAINING_OVERRIDE_IGNORED` flag; structural sources then decide.
 *   Personal "rest" is semantically identical to Performance REST but we
 *   still treat only the five real perf values as authoritative overrides —
 *   personal "rest" is dropped and REST is derived structurally (which will
 *   still yield REST when no sessions exist).
 *
 * WRITE-SIDE PROTECTION:
 *   `setBullsDayType` (see bulls-nutrition.functions.ts) only accepts the
 *   five real Performance Day Types — no new Bulls writes can introduce
 *   legacy values.
 *
 * This module is pure (no I/O). The server-fn `resolvePerformanceDayType`
 * (see day-type-resolver.functions.ts) collects the raw signals from
 * Supabase and delegates the decision here so the logic can be unit-tested
 * without a live DB.
 */

export type PerformanceDayTypeKey =
  | "rest"
  | "strength"
  | "football_training"
  | "game_day"
  | "double_session";

export const ALL_PERFORMANCE_DAY_TYPES: PerformanceDayTypeKey[] = [
  "rest",
  "strength",
  "football_training",
  "game_day",
  "double_session",
];

export type DayTypeSource =
  | "manual_override"
  | "load_management"
  | "structural_double_session"
  | "structural_game_day"
  | "structural_football_training"
  | "structural_strength"
  | "default_rest";


/** Raw signals collected from the DB — normalized and boolean where possible. */
export interface DayTypeResolverSignals {
  /** Raw `day_type_overrides.kind` value for (user, date), or null. */
  manualOverrideKind: string | null;
  /** True if `bulls_hub_events` has a game/match event on the date. */
  hasGameEvent: boolean;
  /** True if an active team football training session applies to this weekday. */
  hasFootballTrainingSession: boolean;
  /** True if an individual/assigned strength session applies to this weekday. */
  hasStrengthSession: boolean;
  /** True if an individual athlete training entry applies (counts as a session). */
  hasIndividualTrainingSession: boolean;
  /**
   * Coach-set Belastungsstufe (0..5) für diesen Tag aus `organization_load_days`.
   * Nur gesetzt, wenn Modul `load_management` aktiv ist und ein Eintrag existiert.
   */
  loadLevel?: number | null;
}

export interface DayTypeResolution {
  dayType: PerformanceDayTypeKey;
  source: DayTypeSource;
  flags: string[];
  signals: DayTypeResolverSignals;
}


/**
 * Normalize a raw `day_type_overrides.kind` value.
 * Only the 5 real Performance Day Types resolve to a concrete key. Legacy
 * personal "training" is flagged as ambiguous; anything else is dropped.
 */
export function normalizeManualOverride(kind: string | null | undefined): {
  dayType: PerformanceDayTypeKey | null;
  legacyIgnored: boolean;
} {
  if (!kind) return { dayType: null, legacyIgnored: false };
  if (
    kind === "rest" ||
    kind === "strength" ||
    kind === "football_training" ||
    kind === "game_day" ||
    kind === "double_session"
  ) {
    return { dayType: kind as PerformanceDayTypeKey, legacyIgnored: false };
  }
  if (kind === "training") {
    return { dayType: null, legacyIgnored: true };
  }
  return { dayType: null, legacyIgnored: false };
}

/**
 * Pure resolver. Deterministic. No I/O.
 *
 * Contract: manual override with a real perf day type ALWAYS wins. Otherwise
 * apply the structural priority ladder. DOUBLE_SESSION requires at least
 * two independent session signals on the same date; football+strength is
 * the canonical case, but football+individual-training or strength+
 * individual-training also count.
 */
export function resolvePerformanceDayTypeFromSignals(
  signals: DayTypeResolverSignals,
): DayTypeResolution {
  const flags: string[] = [];
  const manual = normalizeManualOverride(signals.manualOverrideKind);
  if (manual.legacyIgnored) flags.push("LEGACY_TRAINING_OVERRIDE_IGNORED");

  // 1) Manual real override wins.
  if (manual.dayType) {
    return {
      dayType: manual.dayType,
      source: "manual_override",
      flags,
      signals,
    };
  }

  // Structural detection.
  const sessionCount =
    (signals.hasFootballTrainingSession ? 1 : 0) +
    (signals.hasStrengthSession ? 1 : 0) +
    (signals.hasIndividualTrainingSession ? 1 : 0);

  // 2) Double session: ≥ 2 relevant sessions on the same date.
  if (sessionCount >= 2) {
    return {
      dayType: "double_session",
      source: "structural_double_session",
      flags,
      signals,
    };
  }

  // 3) Game day.
  if (signals.hasGameEvent) {
    return {
      dayType: "game_day",
      source: "structural_game_day",
      flags,
      signals,
    };
  }

  // 4) Football training.
  if (signals.hasFootballTrainingSession) {
    return {
      dayType: "football_training",
      source: "structural_football_training",
      flags,
      signals,
    };
  }

  // 5) Strength (or individual training that isn't football/game).
  if (signals.hasStrengthSession || signals.hasIndividualTrainingSession) {
    return {
      dayType: "strength",
      source: "structural_strength",
      flags,
      signals,
    };
  }

  // 6) Rest — no structural session.
  return {
    dayType: "rest",
    source: "default_rest",
    flags,
    signals,
  };
}

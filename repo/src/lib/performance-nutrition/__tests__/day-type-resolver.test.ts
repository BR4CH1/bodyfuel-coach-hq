import { describe, expect, it } from "vitest";
import {
  normalizeManualOverride,
  resolvePerformanceDayTypeFromSignals,
  type DayTypeResolverSignals,
} from "../day-type-resolver";

function signals(
  overrides: Partial<DayTypeResolverSignals> = {},
): DayTypeResolverSignals {
  return {
    manualOverrideKind: null,
    hasGameEvent: false,
    hasFootballTrainingSession: false,
    hasStrengthSession: false,
    hasIndividualTrainingSession: false,
    ...overrides,
  };
}

describe("normalizeManualOverride — legacy handling", () => {
  it("accepts the five real Performance day types", () => {
    for (const k of [
      "rest",
      "strength",
      "football_training",
      "game_day",
      "double_session",
    ] as const) {
      expect(normalizeManualOverride(k)).toEqual({
        dayType: k,
        legacyIgnored: false,
      });
    }
  });
  it("flags legacy 'training' as ignored (never maps to football/strength)", () => {
    expect(normalizeManualOverride("training")).toEqual({
      dayType: null,
      legacyIgnored: true,
    });
  });
  it("drops unknown values without flagging legacy", () => {
    expect(normalizeManualOverride("foo")).toEqual({
      dayType: null,
      legacyIgnored: false,
    });
    expect(normalizeManualOverride(null)).toEqual({
      dayType: null,
      legacyIgnored: false,
    });
  });
});

describe("resolvePerformanceDayTypeFromSignals — priority ladder", () => {
  it("1. manual override 'strength' wins over every structural signal", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        manualOverrideKind: "strength",
        hasFootballTrainingSession: true,
        hasGameEvent: true,
      }),
    );
    expect(r.dayType).toBe("strength");
    expect(r.source).toBe("manual_override");
  });

  it("2. manual override 'football_training' wins", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ manualOverrideKind: "football_training" }),
    );
    expect(r.dayType).toBe("football_training");
    expect(r.source).toBe("manual_override");
  });

  it("3. football-only session → football_training", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ hasFootballTrainingSession: true }),
    );
    expect(r.dayType).toBe("football_training");
    expect(r.source).toBe("structural_football_training");
  });

  it("4. strength-only session → strength", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ hasStrengthSession: true }),
    );
    expect(r.dayType).toBe("strength");
    expect(r.source).toBe("structural_strength");
  });

  it("5. game event only → game_day", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ hasGameEvent: true }),
    );
    expect(r.dayType).toBe("game_day");
    expect(r.source).toBe("structural_game_day");
  });

  it("6. football + strength on same date → double_session (over game_day)", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        hasFootballTrainingSession: true,
        hasStrengthSession: true,
      }),
    );
    expect(r.dayType).toBe("double_session");
    expect(r.source).toBe("structural_double_session");
  });

  it("6b. double_session even when a game event is also present (double wins)", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        hasFootballTrainingSession: true,
        hasStrengthSession: true,
        hasGameEvent: true,
      }),
    );
    expect(r.dayType).toBe("double_session");
  });

  it("7. no signals → rest", () => {
    const r = resolvePerformanceDayTypeFromSignals(signals());
    expect(r.dayType).toBe("rest");
    expect(r.source).toBe("default_rest");
    expect(r.flags).toEqual([]);
  });

  it("8. legacy 'training' override is ignored + LEGACY_TRAINING_OVERRIDE_IGNORED flag", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ manualOverrideKind: "training" }),
    );
    expect(r.dayType).toBe("rest"); // no structural sessions → REST fallback
    expect(r.flags).toContain("LEGACY_TRAINING_OVERRIDE_IGNORED");
  });

  it("8b. legacy 'training' + football session still resolves to football_training via structure (not manual)", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        manualOverrideKind: "training",
        hasFootballTrainingSession: true,
      }),
    );
    expect(r.dayType).toBe("football_training");
    expect(r.source).toBe("structural_football_training");
    expect(r.flags).toContain("LEGACY_TRAINING_OVERRIDE_IGNORED");
  });

  it("individual training + football counts as double_session", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        hasFootballTrainingSession: true,
        hasIndividualTrainingSession: true,
      }),
    );
    expect(r.dayType).toBe("double_session");
  });

  it("individual training alone → strength (structural strength bucket)", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ hasIndividualTrainingSession: true }),
    );
    expect(r.dayType).toBe("strength");
  });

  it("manual 'rest' override is honoured explicitly", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        manualOverrideKind: "rest",
        hasFootballTrainingSession: true,
      }),
    );
    expect(r.dayType).toBe("rest");
    expect(r.source).toBe("manual_override");
  });

  it("manual 'double_session' override is honoured", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({ manualOverrideKind: "double_session" }),
    );
    expect(r.dayType).toBe("double_session");
    expect(r.source).toBe("manual_override");
  });

  it("manual 'game_day' override is honoured over football+strength", () => {
    const r = resolvePerformanceDayTypeFromSignals(
      signals({
        manualOverrideKind: "game_day",
        hasFootballTrainingSession: true,
        hasStrengthSession: true,
      }),
    );
    expect(r.dayType).toBe("game_day");
    expect(r.source).toBe("manual_override");
  });
});

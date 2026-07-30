import { describe, expect, it } from "vitest";
import {
  normalizeExerciseKey,
  parseRepRange,
  readinessCooldownActive,
  stateFromDecision,
} from "../athlete-exercise-state";
import type { ProgressionDecision } from "../progression";

function decision(overrides: Partial<ProgressionDecision> = {}): ProgressionDecision {
  return {
    action: "increase_load",
    previous_load: 60,
    next_load: 62.5,
    next_target_weights: "62.5",
    next_target_reps: null,
    reason: "Basis",
    ...overrides,
  };
}

describe("normalizeExerciseKey", () => {
  it("normalisiert Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(normalizeExerciseKey("  Bank Drücken ")).toBe("bank_drucken");
  });

  it("entfernt Diakritika und Sonderzeichen", () => {
    expect(normalizeExerciseKey("Schrägbank-Drücken (KH)")).toBe("schragbank_drucken_kh");
  });

  it("entfernt Seitenmarkierungen", () => {
    expect(normalizeExerciseKey("Beinpresse links")).toBe(normalizeExerciseKey("Beinpresse"));
    expect(normalizeExerciseKey("Rudern einarmig")).toBe(normalizeExerciseKey("Rudern"));
  });

  it("liefert leeren Key für leere Namen", () => {
    expect(normalizeExerciseKey("")).toBe("");
  });
});

describe("parseRepRange (state)", () => {
  it("liest Ranges, Einzelwerte und Fallback", () => {
    expect(parseRepRange("6-8")).toEqual({ min: 6, max: 8 });
    expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
    expect(parseRepRange(null)).toEqual({ min: 8, max: 12 });
  });
});

describe("stateFromDecision", () => {
  it("mappt Laststeigerung auf progressing/up mit hoher Confidence", () => {
    const s = stateFromDecision({ exerciseName: "Bankdrücken", repRange: "8-12", decision: decision() });
    expect(s.progression_status).toBe("progressing");
    expect(s.trend).toBe("up");
    expect(s.confidence).toBe("high");
    expect(s.recommended_next_load).toBe(62.5);
    expect(s.target_rep_min).toBe(8);
    expect(s.target_rep_max).toBe(12);
    expect(s.last_decision).toBe("increase_load");
  });

  it("mappt Reduktionen auf deloading/down", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision({ action: "reduce_volume", next_load: 60 }),
    });
    expect(s.progression_status).toBe("deloading");
    expect(s.trend).toBe("down");
  });

  it("mappt keep_load auf holding/flat", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision({ action: "keep_load" }),
    });
    expect(s.progression_status).toBe("holding");
    expect(s.trend).toBe("flat");
    expect(s.confidence).toBe("medium");
  });

  it("setzt Confidence auf low bei zu wenig Daten", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision({ action: "hold_for_more_data" }),
    });
    expect(s.confidence).toBe("low");
  });

  it("deckelt Confidence bei aktiver harter Bremse auf low", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision(),
      readiness: { gateActive: true, cooldownActive: false, gateSeverity: "reduce" },
    });
    expect(s.confidence).toBe("low");
    expect(s.last_reason).toContain("harte Bremse");
  });

  it("deckelt Confidence bei aktiver weicher Bremse auf medium", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision(),
      readiness: { gateActive: true, cooldownActive: false, gateSeverity: "hold" },
    });
    expect(s.confidence).toBe("medium");
  });

  it("deckelt Confidence im Cooldown auf medium", () => {
    const s = stateFromDecision({
      exerciseName: "Bankdrücken",
      repRange: "8-12",
      decision: decision(),
      readiness: { gateActive: false, cooldownActive: true },
    });
    expect(s.confidence).toBe("medium");
    expect(s.last_reason).toContain("Cooldown");
  });
});

describe("readinessCooldownActive", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("ist inaktiv ohne Gate-Events", () => {
    expect(readinessCooldownActive([], now)).toBe(false);
  });

  it("ist aktiv innerhalb von 7 Tagen", () => {
    expect(readinessCooldownActive(["2026-07-27"], now)).toBe(true);
  });

  it("ist inaktiv nach mehr als 7 Tagen", () => {
    expect(readinessCooldownActive(["2026-07-01"], now)).toBe(false);
  });

  it("ignoriert unlesbare Daten", () => {
    expect(readinessCooldownActive(["kaputt"], now)).toBe(false);
  });
});

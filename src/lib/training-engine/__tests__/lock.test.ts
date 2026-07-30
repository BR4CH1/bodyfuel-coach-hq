import { describe, expect, it } from "vitest";
import { applySmartLock, type SmartLock } from "../lock";
import type { ProgressionDecision } from "../progression";

function decision(overrides: Partial<ProgressionDecision> = {}): ProgressionDecision {
  return {
    action: "increase_load",
    previous_load: 60,
    next_load: 62.5,
    next_target_weights: "62.5,62.5,62.5",
    next_target_reps: null,
    reason: "Alle Sätze erreicht.",
    ...overrides,
  };
}

describe("applySmartLock", () => {
  it("lässt die Entscheidung bei 'none' unverändert", () => {
    const d = decision();
    expect(applySmartLock(d, "none")).toBe(d);
    expect(applySmartLock(d, null)).toBe(d);
    expect(applySmartLock(d, undefined)).toBe(d);
  });

  it("blockiert bei 'locked' jede Änderung", () => {
    const out = applySmartLock(decision(), "locked");
    expect(out.action).toBe("keep_load");
    expect(out.next_load).toBe(60);
    expect(out.next_target_weights).toBeNull();
    expect(out.reason).toContain("gesperrt");
  });

  it("erlaubt Gewichtsänderungen nur bei 'weight_only'", () => {
    expect(applySmartLock(decision(), "weight_only").action).toBe("increase_load");
    expect(applySmartLock(decision({ action: "reduce_load" }), "weight_only").action).toBe(
      "reduce_load",
    );
    expect(applySmartLock(decision(), "reps_only").action).toBe("keep_load");
    expect(applySmartLock(decision(), "volume_only").action).toBe("keep_load");
  });

  it("erlaubt Rep-Steigerungen nur bei 'reps_only'", () => {
    const repDecision = decision({
      action: "increase_reps_target",
      next_target_reps: "13",
      next_target_weights: null,
    });
    expect(applySmartLock(repDecision, "reps_only").action).toBe("increase_reps_target");
    expect(applySmartLock(repDecision, "weight_only").action).toBe("keep_load");
    expect(applySmartLock(repDecision, "volume_only").action).toBe("keep_load");
  });

  it("erlaubt Volumenreduktion nur bei 'volume_only'", () => {
    const volDecision = decision({ action: "reduce_volume", next_load: 60 });
    expect(applySmartLock(volDecision, "volume_only").action).toBe("reduce_volume");
    expect(applySmartLock(volDecision, "weight_only").action).toBe("keep_load");
    expect(applySmartLock(volDecision, "reps_only").action).toBe("keep_load");
  });

  it("lässt neutrale Entscheidungen bei jedem Lock durch", () => {
    const locks: SmartLock[] = ["weight_only", "reps_only", "volume_only"];
    for (const lock of locks) {
      expect(applySmartLock(decision({ action: "keep_load" }), lock).action).toBe("keep_load");
      expect(applySmartLock(decision({ action: "hold_for_more_data" }), lock).action).toBe(
        "hold_for_more_data",
      );
    }
  });

  it("behält die Originalbegründung im Lock-Text", () => {
    const out = applySmartLock(decision({ reason: "Originaltext" }), "reps_only");
    expect(out.reason).toContain("Originaltext");
    expect(out.reason).toContain("reps_only");
  });
});

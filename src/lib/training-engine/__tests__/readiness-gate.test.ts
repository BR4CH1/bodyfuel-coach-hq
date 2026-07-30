import { describe, expect, it } from "vitest";
import { applyReadinessGateWithMeta, evaluateReadinessGate } from "../readiness-gate";
import type { ProgressionDecision } from "../progression";
import type { ReadinessCheckin } from "@/lib/readiness";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function checkin(days: number, overrides: Partial<ReadinessCheckin> = {}): ReadinessCheckin {
  return {
    checkin_date: isoDaysAgo(days),
    sleep: 4,
    energy: 4,
    stress: 1,
    training_feel: 4,
    pain_level: 0,
    ...overrides,
  };
}

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

describe("evaluateReadinessGate", () => {
  it("liefert null ohne Check-ins", () => {
    expect(evaluateReadinessGate([])).toBeNull();
  });

  it("liefert null bei guter Readiness", () => {
    const rows = [0, 1, 2, 3].map((d) => checkin(d));
    expect(evaluateReadinessGate(rows)).toBeNull();
  });

  it("bremst hart bei mehreren Schmerzmeldungen", () => {
    const rows = [0, 1, 2].map((d) => checkin(d, { pain_level: 3 }));
    const gate = evaluateReadinessGate(rows);
    expect(gate?.severity).toBe("reduce");
    expect(gate?.reason).toContain("Schmerz");
  });

  it("bremst hart bei sehr niedriger 7-Tage-Readiness", () => {
    const rows = [0, 1, 2].map((d) =>
      checkin(d, { sleep: 0, energy: 0, stress: 5, training_feel: 0 }),
    );
    const gate = evaluateReadinessGate(rows);
    expect(gate?.severity).toBe("reduce");
  });

  it("bremst weich bei mäßig niedriger Readiness", () => {
    const rows = [0, 1, 2].map((d) =>
      checkin(d, { sleep: 2, energy: 2, stress: 3, training_feel: 2 }),
    );
    const gate = evaluateReadinessGate(rows);
    expect(gate?.severity).toBe("hold");
  });
});

describe("applyReadinessGateWithMeta", () => {
  it("lässt die Entscheidung ohne Gate unverändert", () => {
    const d = decision();
    const out = applyReadinessGateWithMeta(d, null);
    expect(out.decision).toBe(d);
    expect(out.applied).toBeNull();
    expect(out.reason).toBeNull();
  });

  it("wandelt Steigerung bei harter Bremse in Halten um", () => {
    const out = applyReadinessGateWithMeta(decision(), {
      severity: "reduce",
      reason: "Ø Readiness 7d = 25",
    });
    expect(out.decision.action).toBe("keep_load");
    expect(out.decision.next_load).toBe(60);
    expect(out.decision.next_target_weights).toBe("60,60,60");
    expect(out.applied).toBe("reduce");
  });

  it("schiebt Steigerung bei weicher Bremse auf", () => {
    const out = applyReadinessGateWithMeta(decision(), {
      severity: "hold",
      reason: "Belastungstrend steigt",
    });
    expect(out.decision.action).toBe("keep_load");
    expect(out.applied).toBe("hold");
    expect(out.decision.reason).toContain("Belastungstrend steigt");
  });

  it("stoppt Rep-Steigerungen bei beiden Bremsstufen", () => {
    const rep = decision({
      action: "increase_reps_target",
      next_target_reps: "13",
      next_target_weights: null,
    });
    expect(applyReadinessGateWithMeta(rep, { severity: "reduce", reason: "x" }).decision.action).toBe(
      "keep_load",
    );
    expect(applyReadinessGateWithMeta(rep, { severity: "hold", reason: "x" }).decision.action).toBe(
      "keep_load",
    );
  });

  it("verstärkt vorsichtige Entscheidungen nur begründend", () => {
    const red = decision({ action: "reduce_load", next_load: 54 });
    const out = applyReadinessGateWithMeta(red, { severity: "reduce", reason: "Schmerz" });
    expect(out.decision.action).toBe("reduce_load");
    expect(out.decision.next_load).toBe(54);
    expect(out.decision.reason).toContain("Readiness bestätigt Vorsicht");
    expect(out.applied).toBe("reduce");
  });

  it("lässt keep_load unverändert", () => {
    const keep = decision({ action: "keep_load", next_load: 60 });
    const out = applyReadinessGateWithMeta(keep, { severity: "hold", reason: "x" });
    expect(out.decision).toBe(keep);
    expect(out.applied).toBeNull();
  });
});

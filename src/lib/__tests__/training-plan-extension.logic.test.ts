import { describe, expect, it } from "vitest";
import {
  buildExtensionBlueprint,
  mirrorBuilderWeeks,
  shiftIsoDate,
  type ExtensionSourceDay,
} from "@/lib/training-plan-extension.logic";

const WD = [1, 2, 3, 4, 5, 6, 0];

function plan(weeks: number, startMonday = "2026-09-07"): ExtensionSourceDay[] {
  const days: ExtensionSourceDay[] = [];
  let sort = 0;
  for (let w = 1; w <= weeks; w++) {
    WD.forEach((wd, idx) => {
      const isTraining = [1, 3, 5].includes(wd);
      days.push({
        id: `w${w}d${wd}`,
        name: isTraining ? `Tag ${wd} — Training` : `Tag ${wd} — Ruhetag`,
        week_number: w,
        sort_order: sort++,
        day_date: shiftIsoDate(startMonday, (w - 1) * 7 + idx),
      });
    });
  }
  return days;
}

describe("buildExtensionBlueprint", () => {
  it("spiegelt 4 Wochen + 2 Wochen relativ (W5=W1, W6=W2) mit verschobenen Daten", () => {
    const existing = plan(4);
    const bp = buildExtensionBlueprint({ existingDays: existing, addWeeks: 2 });

    expect(bp.baseWeeks).toBe(4);
    expect(bp.targetWeeks).toBe(6);
    expect(bp.days).toHaveLength(14);

    const w5 = bp.days.filter((d) => d.week_number === 5);
    const w6 = bp.days.filter((d) => d.week_number === 6);
    expect(w5.every((d) => d.source_week === 1)).toBe(true);
    expect(w6.every((d) => d.source_week === 2)).toBe(true);

    // Woche 5 Montag = Woche 1 Montag + 28 Tage
    expect(w5[0].day_date).toBe("2026-10-05");
    expect(w6[0].day_date).toBe("2026-10-12");
    expect(bp.endDate).toBe("2026-10-18");
  });

  it("behält Ruhetage als Ruhetage (Namen bleiben identisch)", () => {
    const bp = buildExtensionBlueprint({ existingDays: plan(4), addWeeks: 2 });
    const restDay = bp.days.find((d) => d.name.includes("Ruhetag"));
    expect(restDay).toBeTruthy();
    expect(restDay!.source_day_id).toMatch(/^w[12]d/);
  });

  it("vergibt fortlaufende sort_order ohne Kollision", () => {
    const existing = plan(4);
    const bp = buildExtensionBlueprint({ existingDays: existing, addWeeks: 2 });
    const sorts = bp.days.map((d) => d.sort_order);
    expect(Math.min(...sorts)).toBe(28);
    expect(new Set(sorts).size).toBe(sorts.length);
  });

  it("ist idempotent: bereits vorhandene Wochen werden übersprungen", () => {
    const already = plan(6);
    const bp = buildExtensionBlueprint({ existingDays: already, addWeeks: 2 });
    expect(bp.days).toHaveLength(0);
    expect(bp.skippedWeeks).toEqual([7, 8]);
  });

  it("wiederholt das Muster zyklisch bei mehr Zusatzwochen als Basiswochen", () => {
    const bp = buildExtensionBlueprint({ existingDays: plan(2), addWeeks: 3 });
    expect(bp.days.filter((d) => d.week_number === 3).every((d) => d.source_week === 1)).toBe(true);
    expect(bp.days.filter((d) => d.week_number === 4).every((d) => d.source_week === 2)).toBe(true);
    expect(bp.days.filter((d) => d.week_number === 5).every((d) => d.source_week === 1)).toBe(true);
  });

  it("weist ungültige Eingaben ab", () => {
    expect(() => buildExtensionBlueprint({ existingDays: [], addWeeks: 2 })).toThrow();
    expect(() => buildExtensionBlueprint({ existingDays: plan(2), addWeeks: 0 })).toThrow();
  });
});

describe("mirrorBuilderWeeks", () => {
  it("kopiert Übungen in neue Wochen statt sie zu verwerfen", () => {
    const days = [
      { week_number: 1, weekday: 1, exercises: [{ name: "Bankdrücken" }] },
      { week_number: 2, weekday: 1, exercises: [{ name: "Kniebeuge" }] },
    ];
    const out = mirrorBuilderWeeks(days, 4);
    expect(out).toHaveLength(4);
    expect(out[2]).toMatchObject({ week_number: 3, exercises: [{ name: "Bankdrücken" }] });
    expect(out[3]).toMatchObject({ week_number: 4, exercises: [{ name: "Kniebeuge" }] });
    // Deep clone, keine geteilten Referenzen
    expect(out[2].exercises).not.toBe(days[0].exercises);
  });

  it("kürzt beim Verkleinern der Laufzeit", () => {
    const days = [1, 2, 3, 4].map((w) => ({ week_number: w, exercises: [] }));
    expect(mirrorBuilderWeeks(days, 2).map((d) => d.week_number)).toEqual([1, 2]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildTrainingWeekSchedule,
  isoWeekdayToJs,
  jsWeekdayToIso,
  resolveTrainingDay,
  scheduleFromWeekdays,
  splitFromDayName,
  weekdayFromDayName,
  weekdayFromIsoDate,
} from "@/lib/training-schedule.logic";
import { buildBuilderDays } from "@/features/nutrition-plan-builder/lib/plan-builder.logic";
import type { BuilderDay } from "@/lib/plan-builder.functions";

/** Mo Push, Di Pull, Mi Rest, Do Beine, Fr Rest, Sa/So Rest */
const WEEK = [
  { name: "Mo - Gym - Push — Brust, Schultern", sort_order: 0, week_number: 1, exercise_count: 8 },
  { name: "Di - Gym - Pull — Rücken, Bizeps", sort_order: 1, week_number: 1, exercise_count: 8 },
  { name: "Mi - Rest — Ruhe & Erholung", sort_order: 2, week_number: 1, exercise_count: 1 },
  { name: "Do - Gym - Beine — Beine, Gesäß", sort_order: 3, week_number: 1, exercise_count: 8 },
  { name: "Fr - Rest — Erholung", sort_order: 4, week_number: 1, exercise_count: 0 },
];

describe("training-schedule.logic", () => {
  it("liest Wochentage und Splits aus Tagesnamen", () => {
    expect(weekdayFromDayName("Di - Gym - Pull")).toBe(2);
    expect(weekdayFromDayName("Sonntag – Rest")).toBe(0);
    expect(weekdayFromDayName("Tag 1 – Oberkörper")).toBeNull();
    expect(splitFromDayName("Di - Gym - Pull — Rücken, Bizeps")).toBe("Pull · Rücken, Bizeps");
    expect(splitFromDayName("Mo - Gym - Push")).toBe("Push");
  });

  it("ISO- und JS-Wochentage konvertieren korrekt", () => {
    expect(jsWeekdayToIso(0)).toBe(7); // Sonntag
    expect(jsWeekdayToIso(1)).toBe(1); // Montag
    expect(isoWeekdayToJs(7)).toBe(0);
    expect(isoWeekdayToJs(1)).toBe(1);
  });

  it("bestimmt Wochentage aus Kalendertagen UTC-stabil", () => {
    expect(weekdayFromIsoDate("2026-08-04")).toBe(2); // Dienstag
    expect(weekdayFromIsoDate("2026-08-02")).toBe(0); // Sonntag
    expect(weekdayFromIsoDate("2026-08-03")).toBe(1); // Montag
  });

  it("baut die Wochenstruktur ohne Rotation nach Array-Reihenfolge", () => {
    const s = buildTrainingWeekSchedule(WEEK);
    expect(s[1]).toEqual({ type: "training", split: "Push · Brust, Schultern" });
    expect(s[2]).toEqual({ type: "training", split: "Pull · Rücken, Bizeps" });
    expect(s[3]).toEqual({ type: "rest", split: null });
    expect(s[4]).toEqual({ type: "training", split: "Beine · Beine, Gesäß" });
    expect(s[5]).toEqual({ type: "rest", split: null });
  });

  it("kombiniert mehrere Einheiten am selben Wochentag", () => {
    const s = buildTrainingWeekSchedule([
      { name: "Di - Gym - Pull", sort_order: 0, week_number: 1, exercise_count: 6 },
      { name: "Di - Gym - Beine", sort_order: 1, week_number: 1, exercise_count: 5 },
    ]);
    expect(s[2]).toEqual({ type: "training", split: "Pull + Beine" });
  });

  it("nutzt sort_order-Fallback (Mo..So) ohne Datum und Wochentagsname", () => {
    const s = buildTrainingWeekSchedule([
      { name: "Tag 1 – Unterkörper", sort_order: 0, week_number: 1, exercise_count: 7 },
      { name: "Tag 2 – Oberkörper", sort_order: 1, week_number: 1, exercise_count: 7 },
    ]);
    expect(s[1]?.split).toBe("Tag 1 · Unterkörper");
    expect(s[2]?.split).toBe("Tag 2 · Oberkörper");
  });

  it("bevorzugt day_date gegenüber Namen", () => {
    const s = buildTrainingWeekSchedule([
      { name: "Tag A – Pull", day_date: "2026-08-04", sort_order: 3, exercise_count: 5 },
    ]);
    expect(s[2]?.type).toBe("training");
  });

  it("liefert Ruhetag für Wochentage ohne Workout", () => {
    const s = buildTrainingWeekSchedule(WEEK);
    expect(resolveTrainingDay(s, "2026-08-08")).toEqual({ type: "rest", split: null });
  });
});

describe("buildBuilderDays mit Trainingssplit", () => {
  const schedule = buildTrainingWeekSchedule(WEEK);

  it("übernimmt für jeden Kalendertag den richtigen Split", () => {
    const days = buildBuilderDays([], "2026-08-03", 7, [], schedule);
    expect(days[0].type).toBe("training");
    expect(days[0].split).toBe("Push · Brust, Schultern");
    expect(days[1].split).toBe("Pull · Rücken, Bizeps"); // Di 04.08.
    expect(days[2].type).toBe("rest");
    expect(days[2].split).toBeNull();
    expect(days[3].split).toBe("Beine · Beine, Gesäß");
    expect(days[4].type).toBe("rest");
    expect(days[5].type).toBe("rest");
    expect(days[6].type).toBe("rest");
  });

  it("Dienstag 04.08.2026 ist Pull und nicht Push", () => {
    const days = buildBuilderDays([], "2026-08-04", 1, [], schedule);
    expect(days[0].name).toContain("Di 04.08");
    expect(days[0].split).toBe("Pull · Rücken, Bizeps");
    expect(days[0].split).not.toContain("Push");
  });

  it("Sonntag/Montag-Grenze bleibt korrekt", () => {
    const days = buildBuilderDays([], "2026-08-02", 2, [], schedule);
    expect(days[0].name).toContain("So 02.08");
    expect(days[0].type).toBe("rest");
    expect(days[1].name).toContain("Mo 03.08");
    expect(days[1].split).toBe("Push · Brust, Schultern");
  });

  it("verrutscht nicht bei UTC-Zeiten nahe Mitternacht (Europe/Berlin)", () => {
    // 04.08.2026 00:30 Europe/Berlin == 03.08.2026 22:30 UTC
    const berlinDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date("2026-08-03T22:30:00Z"));
    expect(berlinDate).toBe("2026-08-04");
    const days = buildBuilderDays([], berlinDate, 1, [], schedule);
    expect(days[0].split).toBe("Pull · Rücken, Bizeps");
  });

  it("erhält manuelles typeOverride und entfernt dabei den Split", () => {
    const previous: BuilderDay[] = [
      { name: "alt", type: "rest", typeOverride: true, split: "Pull", meals: [] },
    ];
    const days = buildBuilderDays(previous, "2026-08-04", 1, [], schedule);
    expect(days[0].type).toBe("rest");
    expect(days[0].typeOverride).toBe(true);
    expect(days[0].split).toBeNull();
    // Bewusster Neuaufbau rechnet neu
    const rebuilt = buildBuilderDays(previous, "2026-08-04", 1, [], schedule, true);
    expect(rebuilt[0].type).toBe("training");
    expect(rebuilt[0].split).toBe("Pull · Rücken, Bizeps");
  });

  it("bleibt abwärtskompatibel für Pläne ohne Splitinformation", () => {
    const days = buildBuilderDays([], "2026-08-03", 3, [1, 3], null);
    expect(days[0].type).toBe("training");
    expect(days[0].split).toBeNull();
    expect(days[1].type).toBe("rest");
    expect(days[2].type).toBe("training");
    expect(scheduleFromWeekdays([1])[1]).toEqual({ type: "training", split: null });
  });

  it("Partner nutzt seinen eigenen Splitplan", () => {
    const partnerSchedule = buildTrainingWeekSchedule([
      { name: "Di - Gym - Beine", sort_order: 0, week_number: 1, exercise_count: 6 },
    ]);
    const self = buildBuilderDays([], "2026-08-04", 1, [], schedule);
    const partner = buildBuilderDays([], "2026-08-04", 1, [], partnerSchedule);
    expect(self[0].split).toBe("Pull · Rücken, Bizeps");
    expect(partner[0].split).toBe("Beine");
  });
});

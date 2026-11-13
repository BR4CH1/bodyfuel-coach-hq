import { describe, expect, it } from "vitest";
import { buildNutritionReactivationSchedule } from "../nutrition-plan-reactivation.logic";

const days = Array.from({ length: 7 }, (_, i) => ({
  id: `day-${i}`, sort_order: i, day_date: `2026-09-${String(28 + i).padStart(2, "0")}`,
}));
// Use calendar-valid dates across the month boundary.
days.forEach((d, i) => { d.day_date = new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10); });
const base = { today: "2026-11-13", scheduled_start_date: "2026-09-28", scheduled_end_date: "2026-10-04", days };

describe("archived nutrition plan schedule", () => {
  it("moves all seven dates by whole weeks and preserves their identities", () => {
    const result = buildNutritionReactivationSchedule({ ...base, start: "this_week" });
    expect(result.scheduled_start_date).toBe("2026-11-09");
    expect(result.scheduled_end_date).toBe("2026-11-15");
    expect(result.days[4]).toEqual({ id: "day-4", day_date: "2026-11-13" });
  });
  it("schedules next week without changing the duration", () => {
    const result = buildNutritionReactivationSchedule({ ...base, start: "next_week" });
    expect(result.scheduled_start_date).toBe("2026-11-16");
    expect(result.scheduled_end_date).toBe("2026-11-22");
  });
  it("preserves a Tuesday start and training/rest weekday assignments", () => {
    const result = buildNutritionReactivationSchedule({ ...base, start: "this_week", scheduled_start_date: "2026-09-29", scheduled_end_date: "2026-10-05", days: days.map((d) => ({ ...d, day_date: new Date(Date.parse(`${d.day_date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) })) });
    expect(result.scheduled_start_date).toBe("2026-11-10");
    expect(result.scheduled_end_date).toBe("2026-11-16");
    expect(result.days[0].day_date).toBe("2026-11-10");
  });
  it("provides dates for undated imported days without inventing meals", () => {
    const result = buildNutritionReactivationSchedule({ ...base, start: "next_week", scheduled_start_date: null, scheduled_end_date: null, days: days.map((d) => ({ ...d, day_date: null })) });
    expect(result.days[6]).toEqual({ id: "day-6", day_date: "2026-11-22" });
    expect(result.scheduled_end_date).toBe("2026-11-22");
  });
  it("rejects an empty plan", () => {
    expect(() => buildNutritionReactivationSchedule({ ...base, start: "this_week", days: [] })).toThrow("ohne Tage");
  });
  it("rejects a short plan that would already be expired", () => {
    expect(() => buildNutritionReactivationSchedule({ ...base, start: "this_week", days: days.slice(0, 1), scheduled_end_date: "2026-09-28" })).toThrow("abgelaufen");
  });
});
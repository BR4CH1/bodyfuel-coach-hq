/**
 * Retest scheduling: last_tested_at + recommended_retest_days.
 * Falls back to the battery-level value when the test-level value is null.
 */
export function calculateRetestDue(input: {
  lastTestedAt: string | Date;
  testRecommendedDays: number | null;
  batteryRecommendedDays: number | null;
}): string | null {
  const days = input.testRecommendedDays ?? input.batteryRecommendedDays;
  if (!days || days <= 0) return null;
  const base = typeof input.lastTestedAt === "string" ? new Date(input.lastTestedAt) : input.lastTestedAt;
  if (Number.isNaN(base.getTime())) return null;
  const due = new Date(base);
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10); // yyyy-mm-dd
}

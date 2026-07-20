// Shared helpers for shopping-day driven plan windows.

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const DAY_LABEL_DE: Record<string, string> = {
  monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch",
  thursday: "Donnerstag", friday: "Freitag", saturday: "Samstag", sunday: "Sonntag",
};

/**
 * How many days the next plan/shopping window should cover.
 *
 * The shopping list is always for a FULL upcoming cycle (from the next
 * shopping day until the one after), not just the few days until the
 * next shopping day. With a single shopping day per week this returns 7;
 * with multiple shopping days it returns the LONGEST gap between
 * consecutive shopping days (i.e. the cycle the next shop must cover).
 */
export function daysUntilNextShopping(
  shoppingDays: string[] | null | undefined,
  _from: Date = new Date(),
): number {
  if (!shoppingDays || shoppingDays.length === 0) return 7;
  const targets = Array.from(
    new Set(shoppingDays.map((d) => DAY_INDEX[d]).filter((n) => n !== undefined)),
  ).sort((a, b) => a - b);
  if (!targets.length) return 7;
  if (targets.length === 1) return 7;
  let maxGap = 0;
  for (let i = 0; i < targets.length; i++) {
    const next = targets[(i + 1) % targets.length];
    const cur = targets[i];
    const gap = (next - cur + 7) % 7 || 7;
    if (gap > maxGap) maxGap = gap;
  }
  return Math.max(1, maxGap);
}

export function formatShoppingDays(days: string[] | null | undefined): string {
  if (!days || !days.length) return "—";
  return days.map((d) => DAY_LABEL_DE[d] ?? d).join(", ");
}

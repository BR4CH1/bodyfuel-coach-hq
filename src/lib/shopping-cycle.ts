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
 * Days the current plan window should cover, based on selected shopping days.
 * If no day matches, defaults to 7. Always at least 1.
 */
export function daysUntilNextShopping(
  shoppingDays: string[] | null | undefined,
  from: Date = new Date(),
): number {
  if (!shoppingDays || shoppingDays.length === 0) return 7;
  const today = from.getDay();
  const targets = shoppingDays
    .map((d) => DAY_INDEX[d])
    .filter((n) => n !== undefined);
  if (!targets.length) return 7;

  // Find smallest positive delta to a shopping day. If today is a shopping day,
  // we still want the plan to cover until the NEXT shopping day.
  const deltas = targets.map((t) => {
    const d = (t - today + 7) % 7;
    return d === 0 ? 7 : d;
  });
  return Math.max(1, Math.min(...deltas));
}

export function formatShoppingDays(days: string[] | null | undefined): string {
  if (!days || !days.length) return "—";
  return days.map((d) => DAY_LABEL_DE[d] ?? d).join(", ");
}

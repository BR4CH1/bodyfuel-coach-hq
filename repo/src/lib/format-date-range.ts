/**
 * Formats a date range like "14. bis 19.6.2026" or "28.6. bis 3.7.2026".
 * Returns null when both dates are missing.
 */
export function formatDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  if (!startIso && !endIso) return null;
  const start = startIso ? new Date(startIso + "T00:00:00") : null;
  const end = endIso ? new Date(endIso + "T00:00:00") : null;

  const fmt = (d: Date, opts: { withYear?: boolean; withMonth?: boolean } = {}) => {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    if (opts.withYear) return `${day}.${month}.${year}`;
    if (opts.withMonth) return `${day}.${month}.`;
    return `${day}.`;
  };

  if (start && !end) return fmt(start, { withYear: true });
  if (!start && end) return `bis ${fmt(end!, { withYear: true })}`;

  const s = start!;
  const e = end!;
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameYear = s.getFullYear() === e.getFullYear();

  if (sameMonth) {
    return `${fmt(s)} bis ${fmt(e, { withYear: true })}`;
  }
  if (sameYear) {
    return `${fmt(s, { withMonth: true })} bis ${fmt(e, { withYear: true })}`;
  }
  return `${fmt(s, { withYear: true })} bis ${fmt(e, { withYear: true })}`;
}

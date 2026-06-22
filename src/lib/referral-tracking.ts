/**
 * Client-side helpers für Affiliate-Referral-Tracking.
 * - captureReferralFromUrl(): liest ?ref=slug aus der URL und legt ihn in localStorage ab (30 Tage)
 * - getStoredReferral(): liefert den aktuell gespeicherten, nicht abgelaufenen Slug
 * - clearStoredReferral(): löscht ihn (nach erfolgreichem attach)
 */

const KEY = "bf_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { slug: string; ts: number };

export function captureReferralFromUrl(search?: string): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(search ?? window.location.search);
  const raw = sp.get("ref");
  if (!raw) return getStoredReferral();
  const slug = raw.trim().toLowerCase().slice(0, 64);
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return getStoredReferral();
  try {
    localStorage.setItem(KEY, JSON.stringify({ slug, ts: Date.now() } satisfies Stored));
  } catch {
    /* ignore */
  }
  return slug;
}

export function getStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.slug || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.slug;
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

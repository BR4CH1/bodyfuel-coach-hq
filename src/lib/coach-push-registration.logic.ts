export type RecentRegistrationCandidate = {
  created_at?: string | null;
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type RecentRegistrationKind = "free" | "smart" | "account";

const RECENT_REGISTRATION_WINDOW_MS = 20 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export function classifyRecentSelfRegistration(
  user: RecentRegistrationCandidate,
  nowMs = Date.now(),
): RecentRegistrationKind | null {
  if (user.invited_at) return null;

  const metadata = user.user_metadata ?? {};
  if (metadata.created_via === "coach") return null;

  const tier = typeof metadata.tier === "string" ? metadata.tier.toLowerCase() : "";
  const role = typeof metadata.role === "string" ? metadata.role.toLowerCase() : "";
  if (role === "client" && !tier) return null;

  const eventAt = user.email_confirmed_at ?? user.confirmed_at ?? user.created_at ?? null;
  if (!eventAt) return null;

  const eventMs = Date.parse(eventAt);
  if (!Number.isFinite(eventMs)) return null;
  const ageMs = nowMs - eventMs;
  if (ageMs < -CLOCK_SKEW_TOLERANCE_MS || ageMs > RECENT_REGISTRATION_WINDOW_MS) {
    return null;
  }

  if (tier === "free") return "free";
  if (tier === "smart") return "smart";
  return "account";
}

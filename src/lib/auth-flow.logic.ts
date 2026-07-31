export const PUBLIC_APP_ORIGIN = "https://bodyfuel-coaching.com";

const AUTH_PATHS = new Set(["/auth", "/login", "/welcome", "/app"]);

export function sanitizeInternalRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    [...candidate].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate, PUBLIC_APP_ORIGIN);
    if (parsed.origin !== PUBLIC_APP_ORIGIN) return undefined;
    if (AUTH_PATHS.has(parsed.pathname)) return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export type AuthLinkParameters = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  tokenHash?: string;
  type?: string;
  error?: string;
  next?: string;
  mode?: string;
  hasCredentials: boolean;
};

export function parseAuthLink(href: string): AuthLinkParameters {
  const url = new URL(href, PUBLIC_APP_ORIGIN);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (key: string) => url.searchParams.get(key) ?? hash.get(key) ?? undefined;
  const accessToken = get("access_token");
  const refreshToken = get("refresh_token");
  const code = get("code");
  const tokenHash = get("token_hash");

  return {
    accessToken,
    refreshToken,
    code,
    tokenHash,
    type: get("type"),
    error: get("error_description") ?? get("error"),
    next: sanitizeInternalRedirect(get("next")),
    mode: get("mode"),
    hasCredentials: Boolean((accessToken && refreshToken) || code || tokenHash),
  };
}

export type HomeRouteAccess = {
  isPlatformCoach: boolean;
  personalBodyfuelAccess: boolean;
  freeAccess: boolean;
  organizationMemberships: ReadonlyArray<{
    organizationId: string;
    organizationSlug: string;
    membershipStatus: string;
    staffRole: string | null;
  }>;
};

export function determineHomeRoute(access: HomeRouteAccess, measurementCount: number): string {
  if (access.isPlatformCoach) return "/coach";

  const staff = access.organizationMemberships.find((membership) => Boolean(membership.staffRole));
  if (staff) return `/coach/teams/${staff.organizationId}`;

  if (access.personalBodyfuelAccess) {
    return measurementCount > 0 ? "/dashboard" : "/measurements";
  }

  if (access.freeAccess) return "/tracker/app";

  const athlete = access.organizationMemberships.find(
    (membership) => membership.membershipStatus === "active",
  );
  if (athlete) return `/${athlete.organizationSlug}/home`;

  // Sicherer Fallback: niemals zurück auf /app oder /welcome (Redirect-Loop),
  // sondern in den frei zugänglichen Tracker.
  return "/tracker/app";
}

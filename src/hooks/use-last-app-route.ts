import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const LAST_ROUTE_KEY = "bf.navigation.lastRoute.v2";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type StoredRoute = {
  href: string;
  at: number;
};

const EXCLUDED_PREFIXES = [
  "/api",
  "/auth",
  "/login",
  "/app",
  "/welcome",
  "/trial",
  "/smart",
  "/join",
  "/invite",
  "/checkout",
  "/unsubscribe",
  "/datenschutz",
  "/impressum",
  "/trust",
  "/guardian-consent",
  "/.lovable",
  "/.well-known",
  "/mcp",
  // Bulls Hub Sub-Routes sind aktuell defekt — nicht als letzte Route
  // wiederherstellen, sonst hängen Athleten wie Bekim beim App-Öffnen fest.
  "/bulls",
];

function normalizeHref(pathname: string, search = "", hash = "") {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const safeSearch = search && search !== "?" ? search : "";
  const safeHash = hash && hash !== "#" ? hash : "";
  return `${safePath}${safeSearch}${safeHash}`;
}

function isRestorableRoute(href: string | null | undefined) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split(/[?#]/)[0] ?? "/";
  if (path === "/") return false;
  return !EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function rememberLastAppRoute(href: string) {
  if (typeof window === "undefined" || !isRestorableRoute(href)) return;
  try {
    const payload: StoredRoute = { href, at: Date.now() };
    window.localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify(payload));
  } catch {
    /* storage optional */
  }
}

export function getLastAppRoute() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRoute>;
    if (!parsed.href || !parsed.at) return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) return null;
    return isRestorableRoute(parsed.href) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function useRememberLastAppRoute() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  useEffect(() => {
    const search = (location as unknown as { searchStr?: string }).searchStr ?? window.location.search;
    const href = normalizeHref(location.pathname, search, location.hash);
    rememberLastAppRoute(href);
  }, [location.pathname, location.search, location.hash]);
}
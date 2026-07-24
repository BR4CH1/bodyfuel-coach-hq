import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { getMyOrgContexts, type OrgContextEntry } from "@/lib/organizations/organizations.functions";
import { useSession } from "@/lib/bodyfuel/session";

// Aktiver Kontext wird als zusammengesetzter Schlüssel gespeichert:
//   "<slug>:athlete" oder "<slug>:staff"
// So bleibt beim Reload die tatsächlich gewählte Rolle erhalten und
// Dual-Role-User (z. B. SGZ-Athlet + SGZ-Coach) werden nicht auf einen
// einzigen Eintrag zusammengezogen.
const ACTIVE_KEY = "bodyfuel.activeContext";
const MODE_PREFIX = "bodyfuel.orgMode:";
const PERSONAL_CONTEXT = "personal";
const PERSONAL_CONTEXT_ALIASES = new Set([PERSONAL_CONTEXT, "bodyfuel", "mein-bodyfuel", "mein_bodyfuel"]);

export type ActiveOrgContext = { slug: string; mode: "athlete" | "staff" };

function parseActive(raw: string | null): ActiveOrgContext | null {
  if (!raw) return null;
  if (PERSONAL_CONTEXT_ALIASES.has(raw)) return null;
  const [slug, mode] = raw.split(":");
  if (!slug) return null;
  if (mode === "athlete" || mode === "staff") return { slug, mode };
  // Legacy value (slug only): fall back to per-org stored mode, default athlete.
  const legacyMode =
    typeof window !== "undefined"
      ? (localStorage.getItem(MODE_PREFIX + slug) as "athlete" | "staff" | null)
      : null;
  return { slug, mode: legacyMode ?? "athlete" };
}

export function getActiveContext(): string | null {
  // Backwards-compatible: returns only the slug portion for old call sites.
  const parsed = getActiveOrgContext();
  return parsed?.slug ?? null;
}

export function getActiveOrgContext(): ActiveOrgContext | null {
  if (typeof window === "undefined") return null;
  return parseActive(localStorage.getItem(ACTIVE_KEY));
}

export function setActiveContext(slug: string | null, mode?: "athlete" | "staff") {
  if (typeof window === "undefined") return;
  if (!slug || PERSONAL_CONTEXT_ALIASES.has(slug)) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    const chosen: "athlete" | "staff" =
      mode ?? (localStorage.getItem(MODE_PREFIX + slug) as "athlete" | "staff" | null) ?? "athlete";
    localStorage.setItem(ACTIVE_KEY, `${slug}:${chosen}`);
    localStorage.setItem(MODE_PREFIX + slug, chosen);
  }
  window.dispatchEvent(new CustomEvent("bodyfuel:active-context-change"));
}

export function activatePersonalBodyFuelContext() {
  setActiveContext(null);
}
export function getOrgMode(slug: string): "athlete" | "staff" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(MODE_PREFIX + slug);
  return v === "athlete" || v === "staff" ? v : null;
}
export function setOrgMode(slug: string, mode: "athlete" | "staff") {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODE_PREFIX + slug, mode);
}

const STAFF_ROLE_LABEL: Record<string, string> = {
  organization_admin: "Coach",
  coach: "Coach",
  head_coach: "Coach",
  team_coach: "Coach",
  performance_coach: "Coach",
  nutrition_coach: "Coach",
  community_manager: "Coach",
  staff: "Coach",
  custom: "Coach",
};
function staffLabel(role: string) {
  return STAFF_ROLE_LABEL[role] ?? "Coach";
}

// Eindeutiger Context-Key: organization:<id>:role:<athlete|staff>
// Mehrere Team-Zuweisungen innerhalb derselben Organisation werden
// serverseitig bereits zu einer Staff-Zeile pro Org zusammengeführt und
// erzeugen deshalb nicht mehrere identische Coach-Einträge.
function contextKey(orgId: string, role: "athlete" | "staff") {
  return `organization:${orgId}:role:${role}`;
}

export function OrganizationContextSwitcher({ compact = false }: { compact?: boolean }) {
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyOrgContexts);
  const { data: contexts } = useQuery({
    queryKey: ["my-org-contexts", supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx(),
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveOrgContext | null>(getActiveOrgContext());

  useEffect(() => {
    const handler = () => setActive(getActiveOrgContext());
    window.addEventListener("storage", handler);
    window.addEventListener("bodyfuel:active-context-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("bodyfuel:active-context-change", handler);
    };
  }, []);

  if (!supabaseUser || !contexts || contexts.length === 0) return null;

  const activeEntry = active ? contexts.find((e) => e.organization.slug === active.slug) : null;
  const roleLabel =
    active?.mode === "staff"
      ? staffLabel(activeEntry?.staff?.role ?? "coach")
      : active?.mode === "athlete"
      ? "Athlet"
      : null;
  const label = activeEntry
    ? `${activeEntry.organization.name}${roleLabel ? ` – ${roleLabel}` : ""}`
    : "Mein BODYFUEL";

  const goPersonal = () => {
    activatePersonalBodyFuelContext();
    setActive(null);
    setOpen(false);
    navigate({ to: "/dashboard" });
  };

  const goOrg = (entry: OrgContextEntry, mode: "athlete" | "staff") => {
    const slug = entry.organization.slug;
    setOrgMode(slug, mode);
    setActiveContext(slug, mode);
    setActive({ slug, mode });
    setOpen(false);

    if (mode === "staff") {
      navigate({ to: "/coach/teams/$orgId", params: { orgId: entry.organization.id } });
    } else {
      navigate({ to: "/$orgSlug/home", params: { orgSlug: slug } });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-secondary ${compact ? "" : ""}`}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="truncate max-w-[160px]">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover p-1 shadow-lg">
          <button
            type="button"
            onClick={goPersonal}
            className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-secondary ${!active ? "font-bold" : ""}`}
          >
            Mein BODYFUEL
          </button>
          <div className="my-1 border-t border-border" />
          {contexts.flatMap((e) => {
            const hasAthlete = !!e.athlete;
            const hasStaff = !!e.staff;
            const rows: ReactNode[] = [];
            if (hasAthlete) {
              const rowActive =
                active?.slug === e.organization.slug && active?.mode === "athlete";
              rows.push(
                <button
                  key={contextKey(e.organization.id, "athlete")}
                  type="button"
                  onClick={() => goOrg(e, "athlete")}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary ${rowActive ? "font-bold" : ""}`}
                >
                  <span className="truncate">{e.organization.name} – Athlet</span>
                  <span className="ml-2 shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Athlete
                  </span>
                </button>,
              );
            }
            if (hasStaff) {
              const rowActive =
                active?.slug === e.organization.slug && active?.mode === "staff";
              rows.push(
                <button
                  key={contextKey(e.organization.id, "staff")}
                  type="button"
                  onClick={() => goOrg(e, "staff")}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary ${rowActive ? "font-bold" : ""}`}
                >
                  <span className="truncate">{e.organization.name} – Coach</span>
                  <span className="ml-2 shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    {staffLabel(e.staff!.role)}
                  </span>
                </button>,
              );
            }
            return rows;
          })}
        </div>
      )}
    </div>
  );
}

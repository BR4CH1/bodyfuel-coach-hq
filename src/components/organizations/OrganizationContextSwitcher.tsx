import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { getMyOrgContexts, type OrgContextEntry } from "@/lib/organizations/organizations.functions";
import { useSession } from "@/lib/bodyfuel/session";

const ACTIVE_KEY = "bodyfuel.activeContext";
const MODE_PREFIX = "bodyfuel.orgMode:"; // per-org mode: "athlete" | "staff"
const PERSONAL_CONTEXT = "personal";

export function getActiveContext(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}
export function setActiveContext(slug: string | null) {
  if (typeof window === "undefined") return;
  if (slug && slug !== PERSONAL_CONTEXT) localStorage.setItem(ACTIVE_KEY, slug);
  else localStorage.removeItem(ACTIVE_KEY);
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
  organization_admin: "Admin",
  team_coach: "Team Coach",
  performance_coach: "Performance Coach",
  nutrition_coach: "Nutrition Coach",
  community_manager: "Community",
  custom: "Staff",
};
function staffLabel(role: string) {
  return STAFF_ROLE_LABEL[role] ?? "Staff";
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
  const [active, setActive] = useState<string | null>(getActiveContext());

  useEffect(() => {
    const handler = () => setActive(getActiveContext());
    window.addEventListener("storage", handler);
    window.addEventListener("bodyfuel:active-context-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("bodyfuel:active-context-change", handler);
    };
  }, []);

  if (!supabaseUser || !contexts || contexts.length === 0) return null;

  const activeEntry = contexts.find((e) => e.organization.slug === active);
  const label = activeEntry?.organization.name ?? "Mein BODYFUEL";

  const goPersonal = () => {
    activatePersonalBodyFuelContext();
    setActive(null);
    setOpen(false);
    navigate({ to: "/dashboard" });
  };

  const goOrg = (entry: OrgContextEntry, forceMode?: "athlete" | "staff") => {
    const slug = entry.organization.slug;
    setActiveContext(slug);
    setActive(slug);
    setOpen(false);

    const hasAthlete = !!entry.athlete;
    const hasStaff = !!entry.staff;
    let mode: "athlete" | "staff";
    if (forceMode) mode = forceMode;
    else if (hasAthlete && hasStaff) mode = getOrgMode(slug) ?? "athlete";
    else if (hasStaff) mode = "staff";
    else mode = "athlete";
    setOrgMode(slug, mode);

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
        <span className="truncate max-w-[140px]">{label}</span>
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
          {contexts.map((e) => {
            const hasAthlete = !!e.athlete;
            const hasStaff = !!e.staff;
            const dual = hasAthlete && hasStaff;
            const isActive = active === e.organization.slug;
            const currentMode = dual ? (getOrgMode(e.organization.slug) ?? "athlete") : null;
            return (
              <div key={e.organization.id} className="rounded">
                <button
                  type="button"
                  onClick={() => goOrg(e)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary ${isActive ? "font-bold" : ""}`}
                >
                  <span className="truncate">{e.organization.name}</span>
                  <span className="ml-2 flex shrink-0 gap-1">
                    {hasAthlete && (
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Athlete
                      </span>
                    )}
                    {hasStaff && (
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        {staffLabel(e.staff!.role)}
                      </span>
                    )}
                  </span>
                </button>
                {dual && (
                  <div className="mb-1 flex gap-1 px-3 pb-1">
                    <button
                      type="button"
                      onClick={() => goOrg(e, "athlete")}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${currentMode === "athlete" && isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70"}`}
                    >
                      Athletenbereich
                    </button>
                    <button
                      type="button"
                      onClick={() => goOrg(e, "staff")}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${currentMode === "staff" && isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70"}`}
                    >
                      Staffbereich
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { getMyOrganizations } from "@/lib/organizations/organizations.functions";
import { useSession } from "@/lib/bodyfuel/session";

const ACTIVE_KEY = "bodyfuel.activeContext";

export function getActiveContext(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}
export function setActiveContext(slug: string | null) {
  if (typeof window === "undefined") return;
  if (slug) localStorage.setItem(ACTIVE_KEY, slug);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function OrganizationContextSwitcher({ compact = false }: { compact?: boolean }) {
  const { supabaseUser } = useSession();
  const fetchOrgs = useServerFn(getMyOrganizations);
  const { data: memberships } = useQuery({
    queryKey: ["my-orgs", supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchOrgs(),
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(getActiveContext());

  useEffect(() => {
    const handler = () => setActive(getActiveContext());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (!supabaseUser || !memberships || memberships.length === 0) return null;

  const activeMembership = memberships.find((m) => m.organization.slug === active);
  const label = activeMembership?.organization.name ?? "Mein BODYFUEL";

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
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
          <Link
            to="/dashboard"
            onClick={() => {
              setActiveContext(null);
              setActive(null);
              setOpen(false);
            }}
            className={`block rounded px-3 py-2 text-sm hover:bg-secondary ${!active ? "font-bold" : ""}`}
          >
            Mein BODYFUEL
          </Link>
          <div className="my-1 border-t border-border" />
          {memberships.map((m) => (
            <Link
              key={m.organization.id}
              to="/$orgSlug/home"
              params={{ orgSlug: m.organization.slug }}
              onClick={() => {
                setActiveContext(m.organization.slug);
                setActive(m.organization.slug);
                setOpen(false);
              }}
              className={`block rounded px-3 py-2 text-sm hover:bg-secondary ${active === m.organization.slug ? "font-bold" : ""}`}
            >
              {m.organization.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

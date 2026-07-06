import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { OrganizationSummary } from "./organizations.functions";

const Ctx = createContext<OrganizationSummary | null>(null);

export function OrganizationBrandProvider({
  org,
  children,
}: {
  org: OrganizationSummary;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const prev: Record<string, string | null> = {};
    const set = (name: string, val: string | null) => {
      prev[name] = root.style.getPropertyValue(name) || null;
      if (val) root.style.setProperty(name, val);
    };
    if (org.primary_color) set("--org-primary", org.primary_color);
    if (org.secondary_color) set("--org-secondary", org.secondary_color);
    return () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
    };
  }, [org.primary_color, org.secondary_color]);

  return <Ctx.Provider value={org}>{children}</Ctx.Provider>;
}

export function useOrganizationBrand() {
  return useContext(Ctx);
}

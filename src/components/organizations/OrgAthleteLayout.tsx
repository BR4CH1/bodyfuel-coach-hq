import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Dumbbell,
  Apple,
  Users,
  User,
  ClipboardCheck,
  Activity,
  Crown,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { orgTerminology } from "@/lib/organizations/org-type";

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Feature-Key aus organization_features. `null` = immer sichtbar. */
  feature: string | null;
  /** Optionale Aliase — Modul gilt als aktiv, wenn eines davon enabled ist. */
  featureAliases?: string[];
};

// Reihenfolge = Reihenfolge in der Bottom-Nav.
function buildNav(terminologyLabels: { training: string; nutrition: string; community: string }): NavItem[] {
  return [
    { key: "home", label: "Home", to: "/$orgSlug/home", icon: Home, feature: "home" },
    {
      key: "training",
      label: terminologyLabels.training,
      to: "/$orgSlug/training",
      icon: Dumbbell,
      feature: "athletic_training",
      featureAliases: ["training", "smart_training"],
    },
    {
      key: "nutrition",
      label: terminologyLabels.nutrition,
      to: "/$orgSlug/nutrition",
      icon: Apple,
      feature: "nutrition",
      featureAliases: ["smart_nutrition"],
    },
    { key: "community", label: terminologyLabels.community, to: "/$orgSlug/community", icon: Users, feature: "community" },

    { key: "profil", label: "Profil", to: "/$orgSlug/profil", icon: User, feature: null },
  ];
}

export function OrgAthleteLayout({
  slug,
  features,
  primaryColor,
  organizationType,
  terminologyOverrides,
  children,
}: {
  slug: string;
  features: { feature: string; enabled: boolean }[];
  primaryColor?: string | null;
  organizationType?: string | null;
  terminologyOverrides?: Record<string, unknown> | null;
  children: ReactNode;
}) {
  const enabledSet = new Set(features.filter((f) => f.enabled).map((f) => f.feature));
  const term = orgTerminology(organizationType ?? "sports_club", (terminologyOverrides as any) ?? undefined);
  const nav = buildNav({ training: "Training", nutrition: "Ernährung", community: term.isCompany ? "Feed" : "Community" });
  const isFeatureOn = (item: NavItem) => {
    if (item.feature === null) return true;
    if (enabledSet.has(item.feature)) return true;
    return (item.featureAliases ?? []).some((a) => enabledSet.has(a));
  };
  const visible = nav.filter(isFeatureOn);
  const loc = useLocation();

  // Slug-basiertes Theme: Bulls-Vereine rebrandeten Smart-Komponenten via
  // `.bulls-theme` (remappt --gold → --bulls-red). Weitere Orgs später
  // analog über eigene Theme-Klassen einhängen.
  const themeClass = /bulls/i.test(slug) ? "bulls-theme" : "";

  return (
    <div className={`min-h-screen bg-background pb-20 text-foreground ${themeClass}`.trim()}>
      {children}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="mx-auto grid max-w-md"
          style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}
        >
          {visible.map((item) => {
            const Icon = item.icon;
            const path = item.to.replace("$orgSlug", slug);
            const active = loc.pathname === path || loc.pathname.startsWith(path + "/");
            return (
              <Link
                key={item.key}
                to={item.to}
                params={{ orgSlug: slug }}
                className="flex flex-col items-center gap-1 py-2 text-[10px] uppercase tracking-wider transition-colors"
                style={{ color: active ? (primaryColor ?? "#e11d48") : undefined }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className={active ? "font-bold" : "text-muted-foreground"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

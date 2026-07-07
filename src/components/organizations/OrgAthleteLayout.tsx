import { Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, Apple, Users, User, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NavKey = "home" | "training" | "nutrition" | "community" | "profil";
type NavItem = { key: NavKey; label: string; to: string; icon: LucideIcon; feature: string | null };

const ALL_NAV: NavItem[] = [
  { key: "home", label: "Home", to: "/$orgSlug/home", icon: Home, feature: "home" },
  { key: "training", label: "Training", to: "/$orgSlug/training", icon: Dumbbell, feature: "athletic_training" },
  { key: "nutrition", label: "Ernährung", to: "/$orgSlug/nutrition", icon: Apple, feature: null },
  { key: "community", label: "Community", to: "/$orgSlug/community", icon: Users, feature: "community" },
  { key: "profil", label: "Profil", to: "/$orgSlug/profil", icon: User, feature: null },
];

export function OrgAthleteLayout({
  slug,
  features,
  primaryColor,
  children,
}: {
  slug: string;
  features: { feature: string; enabled: boolean }[];
  primaryColor?: string | null;
  children: ReactNode;
}) {
  const enabledSet = new Set(features.filter((f) => f.enabled).map((f) => f.feature));
  const visible = ALL_NAV.filter((n) => n.feature === null || enabledSet.has(n.feature));
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      {children}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
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

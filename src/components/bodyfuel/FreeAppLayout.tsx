import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LayoutDashboard, Apple, Scale, Trophy, LogOut, Sparkles, Dumbbell } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { Logo } from "./Logo";
import { FreeUpsellBanner } from "./FreeUpsellBanner";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/tracker/app", label: "Heute", icon: LayoutDashboard, exact: true },
  { to: "/tracker/app/nutrition", label: "Ernährung", icon: Apple },
  { to: "/tracker/app/training", label: "Training", icon: Dumbbell },
  { to: "/tracker/app/weight", label: "Gewicht", icon: Scale },
  { to: "/tracker/app/achievements", label: "Erfolge", icon: Trophy },
];

export function FreeAppLayout({ children }: { children: ReactNode }) {
  const { supabaseUser, loading, isFreeUser, isCoach, logout, profile } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) {
      navigate({ to: "/tracker/login" });
      return;
    }
    // Coaches & paid clients go to their own areas
    if (isCoach) {
      navigate({ to: "/coach" });
      return;
    }
    if (supabaseUser && !isFreeUser && !isCoach) {
      // Paid client — route to coaching dashboard
      navigate({ to: "/dashboard" });
    }
  }, [supabaseUser, loading, isFreeUser, isCoach, navigate]);

  if (loading) return null;
  if (!supabaseUser || !isFreeUser) return null;

  const displayName = profile?.display_name ?? supabaseUser.email?.split("@")[0] ?? "Athlet";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/60 backdrop-blur lg:flex">
        <div className="border-b border-border px-5 py-5">
          <Link to="/tracker/app"><Logo /></Link>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-primary">Free Tracker</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/"
            className="mt-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" /> Upgrade auf Coaching
          </Link>
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="text-[11px] uppercase tracking-wider text-primary">Free User</div>
            </div>
            <button
              onClick={async () => { await logout(); navigate({ to: "/tracker" }); }}
              className="rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/tracker/app"><Logo /></Link>
        <button
          onClick={async () => { await logout(); navigate({ to: "/tracker" }); }}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="pb-24 lg:ml-60 lg:pb-10">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <FreeUpsellBanner />
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

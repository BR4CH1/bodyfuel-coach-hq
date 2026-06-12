import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Scale,
  TrendingUp,
  FileText,
  Dumbbell,
  Trophy,
  Users,
  LogOut,
  Inbox,
  UserCircle,
} from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { Logo } from "./Logo";
import { getLevel } from "@/lib/bodyfuel/data";
import { totalPoints } from "@/lib/bodyfuel/data";

const clientNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/measurements", label: "Maße", icon: Scale },
  { to: "/nutrition", label: "Ernährung", icon: FileText },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/achievements", label: "Erfolge", icon: Trophy },
  { to: "/profile", label: "Profil", icon: UserCircle },
];

const coachNav = [
  { to: "/coach", label: "Dashboard", icon: LayoutDashboard },
  { to: "/coach/customers", label: "Kunden", icon: Users },
  { to: "/coach/leads", label: "Anfragen", icon: Inbox },
  { to: "/nutrition", label: "Ernährung", icon: FileText },
  { to: "/training", label: "Training", icon: Dumbbell },
];


export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isCoach, supabaseUser, profile, loading, logout } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user && !supabaseUser) navigate({ to: "/login" });
  }, [user, supabaseUser, loading, navigate]);

  if (loading) return null;
  if (!user && !supabaseUser) return null;

  const nav = isCoach ? coachNav : clientNav;
  const points = user ? totalPoints(user) : 0;
  const { level } = getLevel(points);
  const displayName = user?.name ?? profile?.display_name ?? supabaseUser?.email ?? "Coach";
  const avatar = user?.avatar ?? (displayName.slice(0, 2).toUpperCase());
  const roleLabel = user ? level.name : isCoach ? "Coach" : "Mitglied";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/60 backdrop-blur lg:flex">
        <div className="border-b border-border px-5 py-5">
          <Link to={isCoach ? "/coach" : "/dashboard"}>
            <Logo showTagline />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = item.to === "/coach" ? pathname === "/coach" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-gold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
              {avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="text-[11px] uppercase tracking-wider text-gold">{roleLabel}</div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
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
        <Link to={isCoach ? "/coach" : "/dashboard"}>
          <Logo />
        </Link>
        <button
          onClick={() => {
            logout();
            navigate({ to: "/login" });
          }}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Main */}
      <main className="pb-24 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className={`grid grid-cols-${Math.min(nav.length, 7)}`} style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 7)}, minmax(0, 1fr))` }}>
          {nav.slice(0, 7).map((item) => {
            const active = item.to === "/coach" ? pathname === "/coach" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                  active ? "text-gold" : "text-muted-foreground"
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

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  FileText,
  Dumbbell,
  Trophy,
  Users,
  LogOut,
  Inbox,
  UserCircle,
  Shield,
  MessageCircle,
  Bell,
  Users2,
  Sparkles,
} from "lucide-react";
import { getMyUnreadCount, getCoachInbox } from "@/lib/coach-messages.functions";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { Logo } from "./Logo";
import { getLevel } from "@/lib/bodyfuel/data";
import { totalPoints } from "@/lib/bodyfuel/data";
import { ReviewPrompt } from "./ReviewPrompt";
import { SmartPlanReadyPopup } from "./SmartPlanReadyPopup";
import { OrganizationContextSwitcher } from "@/components/organizations/OrganizationContextSwitcher";

const clientNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nutrition", label: "Ernährung", icon: FileText },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/messages", label: "Coach-Chat", icon: MessageCircle },
  { to: "/community", label: "Community", icon: Users },
  { to: "/profile", label: "Profil", icon: UserCircle },
];

const bullsNavItem = { to: "/bulls", label: "Bulls Hub", icon: Shield };

const coachNav = [
  { to: "/coach", label: "Dashboard", icon: LayoutDashboard },
  { to: "/coach/customers", label: "Kunden", icon: Users },
  { to: "/coach/teams", label: "Teams", icon: Users2 },
  { to: "/coach/leads", label: "Anfragen", icon: Inbox },
  { to: "/coach/reviews", label: "Bewertungen", icon: Trophy },
];



export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isCoach, isFreeUser, supabaseUser, profile, loading, logout, hasGroup } = useSession();
  const entitlements = useEntitlements();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBullsRoute = pathname.startsWith("/bulls");
  const freeBullsAccess = isFreeUser && isBullsRoute && hasGroup("bulls");
  const freeRankingAccess = isFreeUser && pathname.startsWith("/ranking");

  // Team-only Nutzer: Vereinsmitglied/-staff OHNE persönliches BodyFuel-Paket
  // und ohne Plattform-Coach-Rolle. Diese Nutzer haben keinen Zugriff auf die
  // persönlichen Client-Bereiche (/dashboard, /training, /nutrition, ...).
  const isTeamOnlyUser =
    !entitlements.loading &&
    !isCoach &&
    !isFreeUser &&
    entitlements.hasTeamAccess &&
    !entitlements.hasAnyPersonalBodyfuel;

  useEffect(() => {
    if (loading) return;
    if (!user && !supabaseUser) navigate({ to: "/login" });
    else if (isFreeUser && !pathname.startsWith("/tracker") && !pathname.startsWith("/ranking") && !(pathname.startsWith("/bulls") && hasGroup("bulls"))) {
      navigate({ to: "/tracker/app" });
    }
  }, [user, supabaseUser, loading, navigate, isFreeUser, pathname, hasGroup]);

  // Team-only Redirect: persönliche Client-Routen sind ohne Smart/Coaching gesperrt.
  useEffect(() => {
    if (!isTeamOnlyUser) return;
    const personalPrefixes = [
      "/dashboard",
      "/training",
      "/nutrition",
      "/messages",
      "/community",
      "/profile",
      "/measurements",
      "/progress",
      "/check-in",
      "/achievements",
      "/strength-check",
      "/daily-checklist",
    ];
    const isPersonal =
      personalPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
      pathname === "/mein-bodyfuel" ||
      pathname.startsWith("/mein-bodyfuel/");
    if (!isPersonal) return;
    const slug = entitlements.primaryOrgSlug;
    if (slug) navigate({ to: "/$orgSlug", params: { orgSlug: slug }, replace: true });
  }, [isTeamOnlyUser, pathname, entitlements.primaryOrgSlug, navigate]);

  // Hard-Gate: BodyFuel Smart Nutzer müssen Onboarding abschließen, bevor sie in die App kommen.
  const [smartGateChecked, setSmartGateChecked] = useState(false);
  useEffect(() => {
    if (loading || !supabaseUser || isCoach || isFreeUser) { setSmartGateChecked(true); return; }
    if (pathname.startsWith("/onboarding/smart") || pathname.startsWith("/auth") || pathname.startsWith("/profile")) {
      setSmartGateChecked(true); return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: pkg }] = await Promise.all([
        supabase.from("profiles").select("smart_onboarding_completed_at").eq("id", supabaseUser.id).maybeSingle(),
        supabase.from("customer_packages").select("package").eq("user_id", supabaseUser.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const isSmart = (pkg?.package as string | undefined) === "smart";
      const done = !!(prof as any)?.smart_onboarding_completed_at;
      if (isSmart && !done) {
        navigate({ to: "/onboarding/smart" });
      } else {
        setSmartGateChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, supabaseUser, isCoach, isFreeUser, pathname, navigate]);

  // Ungelesene Nachrichten für Glocke — Hooks müssen VOR jedem early return aufgerufen werden
  const myUnreadFn = useServerFn(getMyUnreadCount);
  const coachInboxFn = useServerFn(getCoachInbox);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["chat-unread", isCoach, supabaseUser?.id],
    enabled: !!supabaseUser && !isFreeUser,
    refetchInterval: 30_000,
    queryFn: async () => {
      try {
        if (isCoach) {
          const inbox = await coachInboxFn();
          return (inbox ?? []).reduce((s: number, t: any) => s + (t.unread_count ?? 0), 0);
        }
        const r = await myUnreadFn();
        return r?.count ?? 0;
      } catch {
        return 0;
      }
    },
  });

  if (loading) return null;
  if (!user && !supabaseUser) return null;
  if (isFreeUser && !freeBullsAccess && !freeRankingAccess) return null;
  if (!smartGateChecked) return null;

  // Nav-Auswahl:
  // 1) Plattform-Coach → coachNav
  // 2) Team-only Nutzer → reduzierte Vereins-Nav (Zum Verein + Mein BodyFuel)
  // 3) Sonst → klassische Client-Nav (+ Bulls, wenn Gruppe vorhanden)
  const staffRoleLabel =
    entitlements.primaryStaffRole === "organization_admin" ? "Vereinsleitung" :
    entitlements.primaryStaffRole === "head_coach" ? "Head Coach" :
    entitlements.primaryStaffRole === "team_coach" ? "Teamcoach" :
    entitlements.primaryStaffRole === "staff" ? "Staff" :
    null;

  // Rollenabhängige Vereins-Navigation. Source of Truth ist
  // `entitlements.primaryStaffRole` (siehe useEntitlements — spiegelt
  // deriveOrgRole).
  const orgId = entitlements.primaryOrgId;
  const orgSlug = entitlements.primaryOrgSlug;
  const staffRole = entitlements.primaryStaffRole;
  const cockpitBase = orgId ? `/coach/teams/${orgId}` : null;

  const buildStaffNav = () => {
    if (!cockpitBase) return null;
    if (staffRole === "organization_admin") {
      return [
        { to: cockpitBase, hash: "cockpit", label: "Leitungs-Cockpit", icon: LayoutDashboard },
        { to: cockpitBase, hash: "teams", label: "Teams", icon: Users2 },
        { to: cockpitBase, hash: "staff", label: "Staff", icon: Shield },
        { to: cockpitBase, hash: "community", label: "Community", icon: Users },
        { to: "/profile", label: "Profil", icon: UserCircle },
      ];
    }
    if (staffRole === "head_coach" || staffRole === "team_coach") {
      return [
        { to: cockpitBase, hash: "cockpit", label: "Coach-Cockpit", icon: LayoutDashboard },
        { to: cockpitBase, hash: "athletes", label: "Athleten", icon: Users },
        { to: cockpitBase, hash: "training", label: "Training", icon: Dumbbell },
        { to: cockpitBase, hash: "community", label: "Community", icon: Users2 },
        { to: "/profile", label: "Profil", icon: UserCircle },
      ];
    }
    if (staffRole === "staff") {
      return [
        { to: cockpitBase, hash: "cockpit", label: "Cockpit", icon: LayoutDashboard },
        { to: cockpitBase, hash: "community", label: "Community", icon: Users2 },
        { to: "/profile", label: "Profil", icon: UserCircle },
      ];
    }
    return null;
  };
  const staffNav = buildStaffNav();
  // Team-only Athleten fallen auf ihre eigene Vereinsroute via OrgAthleteLayout
  // zurück (siehe Redirect oben). Hier bekommen sie eine minimale Sidebar.
  const teamOnlyAthleteNav = isTeamOnlyUser && orgSlug && !staffNav
    ? [
        { to: `/${orgSlug}/home`, label: "Home", icon: LayoutDashboard },
        { to: "/profile", label: "Profil", icon: UserCircle },
      ]
    : null;
  const baseNav = isCoach
    ? coachNav
    : (staffNav ?? teamOnlyAthleteNav ?? clientNav);
  const nav = !isCoach && !staffNav && !teamOnlyAthleteNav && hasGroup("bulls")
    ? [...baseNav, bullsNavItem]
    : baseNav;
  // Mobile bottom nav: Coach-Chat ist in die obere Leiste gewandert
  const mobileNav = nav.filter((item) => item.to !== "/messages");
  const points = user ? totalPoints(user) : 0;
  const { level } = getLevel(points);
  const displayName = user?.name ?? profile?.display_name ?? supabaseUser?.email ?? "Coach";
  const avatar = user?.avatar ?? (displayName.slice(0, 2).toUpperCase());
  const roleLabel = staffRoleLabel
    ? staffRoleLabel
    : isTeamOnlyUser
    ? "Vereinsmitglied"
    : user
    ? level.name
    : isCoach
    ? "Coach"
    : "Mitglied";
  const chatHref = isCoach ? "/coach" : "/messages";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/60 backdrop-blur lg:flex">
        <div className="border-b border-border px-5 py-5">
          <Link to={isCoach ? "/coach" : "/dashboard"}>
            <Logo showTagline />
          </Link>
          <div className="mt-3">
            <OrganizationContextSwitcher compact />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const hash = (item as any).hash as string | undefined;
            const currentHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
            const active =
              item.to === "/coach"
                ? pathname === "/coach"
                : hash
                ? pathname === item.to && (currentHash || "cockpit") === hash
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}#${hash ?? ""}-${item.label}`}
                to={item.to}
                hash={hash}
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
        <div className="flex items-center gap-1">
          <OrganizationContextSwitcher compact />
          {!isFreeUser && (
            <>
              <Link
                to={chatHref}
                className="relative rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label="Coach-Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </Link>
              <Link
                to={chatHref}
                className="relative rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label="Benachrichtigungen"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}
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
        </div>
      </header>

      {/* Main */}
      <main className="pb-24 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(mobileNav.length, 7)}, minmax(0, 1fr))` }}>
          {mobileNav.slice(0, 7).map((item) => {
            const hash = (item as any).hash as string | undefined;
            const currentHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
            const active =
              item.to === "/coach"
                ? pathname === "/coach"
                : hash
                ? pathname === item.to && (currentHash || "cockpit") === hash
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}#${hash ?? ""}-${item.label}`}
                to={item.to}
                hash={hash}
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

      <ReviewPrompt />
      {!isCoach && !isFreeUser && !isTeamOnlyUser && supabaseUser?.id && (
        <SmartPlanReadyPopup userId={supabaseUser.id} />
      )}
    </div>
  );
}

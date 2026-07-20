import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Apple,
  User,
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
  ClipboardList,
  Target,
  Settings,
  Gauge,
  Rocket,

} from "lucide-react";
import { getMyUnreadCount, getCoachInbox } from "@/lib/coach-messages.functions";
import { getIsPlatformOwner } from "@/lib/organizations/organizations.functions";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { Logo } from "./Logo";
import { getLevel } from "@/lib/bodyfuel/data";
import { totalPoints } from "@/lib/bodyfuel/data";
import { ReviewPrompt } from "./ReviewPrompt";
import { SmartPlanReadyPopup } from "./SmartPlanReadyPopup";
import { OrganizationContextSwitcher, getActiveContext } from "@/components/organizations/OrganizationContextSwitcher";
import { listMyCourseInstructorOrgs } from "@/lib/course-instructor.functions";

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
  const { pathname, hash: routeHash } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }),
  });
  const routeOrgId = pathname.match(/^\/coach\/teams\/([^/]+)/)?.[1] ?? null;
  const isBullsRoute = pathname.startsWith("/bulls");
  const isCoachTeamsRoute = /^\/coach\/teams(\/|$)/.test(pathname);
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

  const orgId = routeOrgId ?? entitlements.primaryOrgId;
  const orgSlug = entitlements.primaryOrgSlug;
  const staffRole = entitlements.primaryStaffRole;
  const isPlatformCoachOrgRoute = isCoach && !!routeOrgId;
  const cockpitBase = orgId ? `/coach/teams/${orgId}` : null;

  // Hooks müssen immer vor möglichen early returns stehen. Dieser Query wurde
  // nachträglich unter die Returns verschoben und konnte Logins/Dashboards
  // mit einem Hook-Order-Fehler abbrechen.
  const { data: orgTeamCount = 0 } = useQuery({
    queryKey: ["sidebar-org-team-count", orgId],
    enabled: !!orgId && (isPlatformCoachOrgRoute || staffRole === "organization_admin" || staffRole === "head_coach"),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("organization_teams")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", orgId!);
      return count ?? 0;
    },
  });

  // Modul-Flags dieser Organisation für die dynamische Nav.
  const { data: orgFeatures = [] as { feature: string; enabled: boolean }[] } = useQuery({
    queryKey: ["sidebar-org-features", orgId],
    enabled: !!orgId && (isPlatformCoachOrgRoute || !!staffRole),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_features")
        .select("feature, enabled")
        .eq("organization_id", orgId!);
      return (data ?? []) as { feature: string; enabled: boolean }[];
    },
  });
  const orgFeatureOn = (k: string) =>
    orgFeatures.some((f) => f.feature === k && f.enabled);


  const isOwnerFn = useServerFn(getIsPlatformOwner);
  const { data: isPlatformOwner = false } = useQuery({
    queryKey: ["is-platform-owner"],
    queryFn: () => isOwnerFn(),
    enabled: !!isCoach,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (loading) return;
    if (!user && !supabaseUser) navigate({ to: "/login" });
    else if (isFreeUser && !pathname.startsWith("/tracker") && !pathname.startsWith("/ranking") && !(pathname.startsWith("/bulls") && hasGroup("bulls"))) {
      navigate({ to: "/tracker/app" });
    }
  }, [user, supabaseUser, loading, navigate, isFreeUser, pathname, hasGroup]);

  // Wenn ein Vereinskontext aktiv ist (z. B. „COESFELD BULLS"), sollen
  // persönliche Athleten-Bereiche automatisch in den Vereins-Hub geleitet
  // werden. Ein Bulls-Membership allein darf aber keinen Organisationskontext
  // erzwingen: „Mein BODYFUEL" ist ein persönlicher Bereich, keine Org.
  useEffect(() => {
    if (loading || isCoach) return;
    const activeSlug = getActiveContext();
    if (!activeSlug) return;
    const personalToOrg: Record<string, string> = {
      "/dashboard": "home",
      "/nutrition": "nutrition",
      "/training": "training",
      "/community": "community",
    };
    for (const [prefix, target] of Object.entries(personalToOrg)) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        const suffix = pathname === prefix ? "" : pathname.slice(prefix.length);
        navigate({
          to: `/$orgSlug/${target}${suffix}`,
          params: { orgSlug: activeSlug } as any,
          replace: true,
        } as any);
        return;
      }
    }
  }, [loading, isCoach, pathname, navigate]);

  // Redirect für Vereins-Staff (Vereinsleitung / Head Coach / Team Coach / Staff):
  // Persönliche Athleten-Routen wie /measurements, /progress, /check-in gehören
  // nicht zur Coach-Erfahrung. Coaches landen stattdessen im Cockpit.
  // Team-only Athleten (Vereinsmitglied ohne persönliches BodyFuel-Paket)
  // gehen weiterhin auf ihr Vereins-Dashboard.
  useEffect(() => {
    if (entitlements.loading) return;
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

    // Staff mit Vereinsfunktion → direkt ins passende Cockpit.
    const staffRole = entitlements.primaryStaffRole;
    const orgId = entitlements.primaryOrgId;
    const isStaffUser = !isCoach && !!staffRole && !entitlements.hasAnyPersonalBodyfuel;
    if (isStaffUser && orgId && pathname !== "/profile") {
      navigate({ to: "/coach/teams/$orgId", params: { orgId }, replace: true });
      return;
    }

    // Team-only Athlet ohne persönliches Paket → Vereins-Landing.
    if (isTeamOnlyUser) {
      const slug = entitlements.primaryOrgSlug;
      if (slug) navigate({ to: "/$orgSlug", params: { orgSlug: slug }, replace: true });
    }
  }, [
    entitlements.loading,
    entitlements.primaryStaffRole,
    entitlements.primaryOrgId,
    entitlements.primaryOrgSlug,
    entitlements.hasAnyPersonalBodyfuel,
    isTeamOnlyUser,
    isCoach,
    pathname,
    navigate,
  ]);

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

  // Bulls / Organisations-Onboarding-Gate: Bestehende Bulls-Spieler haben
  // bislang kein Onboarding durchlaufen. Wenn sie sich erneut anmelden, muss
  // das Onboarding automatisch erscheinen — unabhängig davon, welche Route sie
  // öffnen (/bulls, /dashboard, /nutrition, ...). Ausgenommen sind Auth-,
  // Profil- und die Onboarding-Route selbst.
  useEffect(() => {
    if (loading || !supabaseUser || isCoach) return;
    if (
      pathname.startsWith("/auth") ||
      pathname.startsWith("/coach") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/onboarding") ||
      /^\/[^/]+\/onboarding(\/|$)/.test(pathname)
    ) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("organization_memberships")
        .select("onboarding_completed, organization:organizations!inner(slug, status)")
        .eq("user_id", supabaseUser.id)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (cancelled || !data) return;
      const pending = (data as any[]).find(
        (m) => m.organization?.status === "active" && !m.onboarding_completed && m.organization?.slug,
      );
      if (pending) {
        navigate({
          to: "/$orgSlug/onboarding",
          params: { orgSlug: pending.organization.slug } as any,
          replace: true,
        } as any);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, supabaseUser, isCoach, pathname, navigate]);



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

  // Kursleiter-Zusatzmodul: sichtbar, sobald der Nutzer in mindestens einer
  // Organisation als Kursleiter freigeschaltet wurde (pro Mitgliedschaft, nicht
  // organisationsweit). Der Hook muss vor allen Early Returns stehen, sonst
  // crasht React nach dem Login mit Hook-Order-Fehlern.
  const uid = supabaseUser?.id;
  const listCourseInstructorOrgsFn = useServerFn(listMyCourseInstructorOrgs);
  const [activeOrgContext, setActiveOrgContext] = useState<string | null>(() => getActiveContext());
  useEffect(() => {
    const handler = () => setActiveOrgContext(getActiveContext());
    window.addEventListener("storage", handler);
    window.addEventListener("bodyfuel:active-context-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("bodyfuel:active-context-change", handler);
    };
  }, []);
  const { data: coachToolsOrgEnabled = false } = useQuery({
    queryKey: ["coach-tools-instructor-enabled", uid, activeOrgContext],
    enabled: !!uid && !isCoach,
    staleTime: 60_000,
    queryFn: async () => {
      if (!activeOrgContext) return false;
      const result = await listCourseInstructorOrgsFn();
      return (result.orgSlugs ?? []).includes(activeOrgContext);
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
  // Teams-Link nur einblenden, wenn der Verein mehrere Teams hat. Bei genau
  // einem Team wird der Team-Kontext ohnehin direkt verwendet.
  const showTeamsLink = orgTeamCount > 1;

  const buildStaffNav = () => {
    if (!cockpitBase || !orgId) return null;
    const cockpitTarget = {
      to: "/coach/teams/$orgId",
      params: { orgId },
      activePath: cockpitBase,
    };
    // Modul-Flags: Wenn keine Feature-Zeilen geladen wurden (noch), alle
    // Module als aktiv behandeln — sonst würde ein Nav-Flackern entstehen.
    const hasFeatureData = orgFeatures.length > 0;
    const modOn = (k: string) => (hasFeatureData ? orgFeatureOn(k) : true);
    const trainingOn = modOn("athletic_training") || modOn("training") || modOn("smart_training");
    const communityOn = modOn("community");
    const loadOn = modOn("load_management");
    const challengesOn = modOn("challenges");
    void challengesOn;

    if (isPlatformCoachOrgRoute || staffRole === "organization_admin" || staffRole === "head_coach") {
      const cockpitLabel = isPlatformCoachOrgRoute
        ? "Vereins-Cockpit"
        : staffRole === "organization_admin"
        ? "Leitungs-Cockpit"
        : "Coach-Cockpit";
      const items: any[] = [
        { ...cockpitTarget, hash: "cockpit", label: cockpitLabel, icon: LayoutDashboard },
        { ...cockpitTarget, hash: "athletes", label: "Athleten", icon: Users },
        ...(showTeamsLink ? [{ ...cockpitTarget, hash: "teams", label: "Teams", icon: Users2 }] : []),
        ...(trainingOn ? [{ ...cockpitTarget, hash: "training", label: "Training", icon: Dumbbell }] : []),
        ...(loadOn ? [{ ...cockpitTarget, hash: "load", label: "Belastung", icon: Gauge }] : []),
        { ...cockpitTarget, hash: "tasks", label: "Aufgaben", icon: ClipboardList },
        ...(communityOn ? [{ ...cockpitTarget, hash: "community", label: "Community", icon: Users2 }] : []),
        { ...cockpitTarget, hash: "staff", label: "Mitarbeiter", icon: Shield },
        { ...cockpitTarget, hash: "modules", label: "Module", icon: Settings },
        { to: "/profile", label: "Profil", icon: UserCircle },
      ];
      return items;
    }
    if (staffRole === "team_coach") {
      return [
        { ...cockpitTarget, hash: "cockpit", label: "Coach-Cockpit", icon: LayoutDashboard },
        { ...cockpitTarget, hash: "athletes", label: "Athleten", icon: Users },
        ...(trainingOn ? [{ ...cockpitTarget, hash: "training", label: "Training", icon: Dumbbell }] : []),
        ...(loadOn ? [{ ...cockpitTarget, hash: "load", label: "Belastung", icon: Gauge }] : []),
        ...(communityOn ? [{ ...cockpitTarget, hash: "community", label: "Community", icon: Users2 }] : []),
        { to: "/profile", label: "Profil", icon: UserCircle },
      ];
    }
    if (staffRole === "staff") {
      return [
        { ...cockpitTarget, hash: "cockpit", label: "Cockpit", icon: LayoutDashboard },
        ...(communityOn ? [{ ...cockpitTarget, hash: "community", label: "Community", icon: Users2 }] : []),
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
  // Plattform-Coaches (inkl. platform_owner) sehen ihre normale Coach-Nav
  // (Dashboard, Kunden, Teams, Anfragen …). Nur wenn sie tatsächlich in einem
  // Vereins-Cockpit (/coach/teams/:orgId) unterwegs sind, wird die
  // Cockpit-Sidebar eingeblendet. Ein Staff-Assignment (z. B. weil der Owner
  // eine Performance-Team-Organisation angelegt hat) darf die Coach-Nav nicht
  // dauerhaft überschreiben.
  const baseNavRaw = isCoach
    ? (isPlatformCoachOrgRoute && staffNav ? staffNav : coachNav)
    : (staffNav ?? teamOnlyAthleteNav ?? clientNav);
  const baseNav = isCoach && isPlatformOwner
    ? [
        ...baseNavRaw.slice(0, 3),
        { to: "/coach/performance-teams", label: "Performance Teams", icon: Shield },
        ...baseNavRaw.slice(3),
      ]
    : baseNavRaw;
  const navWithBulls = !isCoach && !staffNav && !teamOnlyAthleteNav && hasGroup("bulls")
    ? [...baseNav, bullsNavItem]
    : baseNav;
  const navWithCourseTools = coachToolsOrgEnabled && !isCoach
    ? [
        ...navWithBulls.slice(0, Math.max(1, navWithBulls.length - 1)),
        { to: "/coach-tools", label: "Coach Tools", icon: Rocket } as any,
        ...navWithBulls.slice(Math.max(1, navWithBulls.length - 1)),
      ]
    : navWithBulls;
  // Wenn der Nutzer aktuell im Bulls-Hub ist, sollen Ernährung/Training auf
  // die Bulls-Varianten zeigen, damit das Vereins-Design (rot/schwarz) und
  // die Bulls-spezifische Erfahrung erhalten bleiben.
  const nav = isBullsRoute
    ? navWithCourseTools
        .filter((item: any) => item.to !== "/bulls")
        .map((item: any) => {
          if (item.to === "/dashboard") return { ...item, to: "/bulls", label: "Home", icon: Home };
          if (item.to === "/nutrition") return { ...item, to: "/bulls/nutrition", icon: Apple };
          if (item.to === "/training") return { ...item, to: "/bulls/training", icon: Dumbbell };
          if (item.to === "/profile") return { ...item, icon: User };
          return item;
        })
        // Bulls-Reihenfolge: Home · Training · Ernährung · Community · Profil
        .sort((a: any, b: any) => {
          const order = ["/bulls", "/bulls/training", "/bulls/nutrition", "/community", "/profile"];
          const ia = order.indexOf(a.to);
          const ib = order.indexOf(b.to);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
    : navWithCourseTools;
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
    <div className={`min-h-screen bg-background text-foreground ${isBullsRoute ? "bulls-theme" : ""}`.trim()}>
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
            const currentHash = (routeHash ?? "").replace(/^#/, "");
            const activePath = (item as any).activePath ?? item.to;
            const active =
              item.to === "/coach"
                ? pathname === "/coach"
                : hash
                ? pathname === activePath && (currentHash || "cockpit") === hash
                : pathname.startsWith(activePath);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}#${hash ?? ""}-${item.label}`}
                to={item.to as any}
                params={(item as any).params}
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
      <main className={`lg:ml-64 lg:pb-10 ${isCoachTeamsRoute ? "pb-10" : "pb-24"}`}>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav — hidden on coach org detail pages */}
      {!isCoachTeamsRoute && (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto no-scrollbar">
          {mobileNav.map((item) => {
            const hash = (item as any).hash as string | undefined;
            const currentHash = (routeHash ?? "").replace(/^#/, "");
            const activePath = (item as any).activePath ?? item.to;
            const active =
              item.to === "/coach"
                ? pathname === "/coach"
                : hash
                ? pathname === activePath && (currentHash || "cockpit") === hash
                : pathname.startsWith(activePath);
            const Icon = item.icon;
            const label = (item.label === "Vereins-Cockpit" || item.label === "Leitungs-Cockpit" || item.label === "Coach-Cockpit")
              ? "Cockpit"
              : item.label;
            return (
              <Link
                key={`${item.to}#${hash ?? ""}-${item.label}`}
                to={item.to as any}
                params={(item as any).params}
                hash={hash}
                className={`flex shrink-0 basis-[72px] flex-col items-center gap-1 py-2.5 font-medium ${
                  isBullsRoute ? "text-[10px] uppercase tracking-wider" : "text-[11px]"
                } ${active ? "text-gold" : "text-muted-foreground"}`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active && isBullsRoute ? 2.4 : undefined} />
                <span className={`truncate max-w-[68px] ${active && isBullsRoute ? "font-bold" : ""}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      <ReviewPrompt />
      {!isCoach && !isFreeUser && !isTeamOnlyUser && supabaseUser?.id && (
        <SmartPlanReadyPopup userId={supabaseUser.id} />
      )}
    </div>
  );
}

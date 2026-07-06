import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import { Button } from "@/components/ui/button";
import { Route as OrgLayoutRoute } from "./$orgSlug";
import { getOrgMode, setOrgMode, setActiveContext } from "@/components/organizations/OrganizationContextSwitcher";

export const Route = createFileRoute("/$orgSlug/")({
  component: OrgIndex,
});

function OrgIndex() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getOrganizationContext);
  const { data: ctx, isFetching } = useQuery({
    queryKey: ["org-ctx", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx({ data: { slug: org.slug } }),
  });
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    if (!supabaseUser || !ctx) return;
    const hasAthlete = !!ctx.membership;
    const hasStaff = !!ctx.staff;
    const isSuper = !!ctx.is_super_admin;
    if (!hasAthlete && !hasStaff && !isSuper) return;

    setActiveContext(org.slug);

    if (hasAthlete && !hasStaff && !isSuper) {
      if (!ctx.membership!.onboarding_completed) {
        navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: org.slug }, replace: true });
      } else {
        navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
      }
      return;
    }

    if (!hasAthlete && (hasStaff || isSuper)) {
      setOrgMode(org.slug, "staff");
      navigate({ to: "/coach/teams/$orgId", params: { orgId: ctx.organization.id }, replace: true });
      return;
    }

    // Dual role: on first use (no persisted mode), prompt.
    const stored = getOrgMode(org.slug);
    if (!stored) {
      setNeedsChoice(true);
      return;
    }
    if (stored === "staff") {
      navigate({ to: "/coach/teams/$orgId", params: { orgId: ctx.organization.id }, replace: true });
    } else {
      if (ctx.membership && !ctx.membership.onboarding_completed) {
        navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: org.slug }, replace: true });
      } else {
        navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
      }
    }
  }, [supabaseUser, ctx, navigate, org.slug]);

  const chooseMode = (mode: "athlete" | "staff") => {
    setOrgMode(org.slug, mode);
    setNeedsChoice(false);
    if (mode === "staff") {
      navigate({ to: "/coach/teams/$orgId", params: { orgId: ctx!.organization.id }, replace: true });
    } else if (ctx?.membership && !ctx.membership.onboarding_completed) {
      navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: org.slug }, replace: true });
    } else {
      navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
    }
  };

  if (loading || (supabaseUser && isFetching && !ctx)) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;
  }

  if (needsChoice && ctx) {
    const bg = org.primary_color ?? "#111111";
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="mb-6 h-20 w-20 rounded-full object-cover" />
          ) : null}
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Wie möchtest du {org.name} öffnen?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Du hast in dieser Organisation sowohl einen Athleten- als auch einen Staffzugang.
          </p>
          <div className="mt-8 grid w-full gap-3">
            <Button size="lg" style={{ background: bg }} onClick={() => chooseMode("athlete")}>
              Athletenbereich
            </Button>
            <Button size="lg" variant="outline" onClick={() => chooseMode("staff")}>
              Staffbereich
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Du kannst später jederzeit über den Kontext-Switcher wechseln.
          </p>
        </div>
      </div>
    );
  }


  const bg = org.primary_color ?? "#111111";

  if (!supabaseUser) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="mb-6 h-24 w-24 rounded-full object-cover" />
          ) : (
            <div
              className="mb-6 grid h-24 w-24 place-items-center rounded-full text-3xl font-bold text-white"
              style={{ background: bg }}
            >
              {org.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="font-display text-3xl font-bold">{org.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Willkommen im {org.name} Bereich auf BODYFUEL.
          </p>
          <div className="mt-8 grid w-full gap-3">
            <Button asChild size="lg" style={{ background: bg }}>
              <Link
                to="/auth"
                search={{ next: `/${org.slug}` }}
              >
                Anmelden
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Zugang nur mit persönlicher Einladung deiner Organisation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Signed in but no membership/staff.
  if (ctx && !ctx.membership && !ctx.staff && !ctx.is_super_admin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Kein Zugriff</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Du bist bei BODYFUEL angemeldet, hast aber keinen Zugang zu {org.name}. Bitte fordere
            einen Einladungslink bei deiner Organisation an.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/dashboard">Zurück zu BODYFUEL</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

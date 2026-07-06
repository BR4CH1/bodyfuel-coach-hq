import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import { Button } from "@/components/ui/button";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/home")({
  component: OrgHome,
});

function OrgHome() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getOrganizationContext);

  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, loading, org.slug, navigate]);

  const { data: ctx } = useQuery({
    queryKey: ["org-ctx", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx({ data: { slug: org.slug } }),
  });

  if (!ctx) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const bg = org.primary_color ?? "#111111";
  const activeFeatures = ctx.features.filter((f) => f.enabled).map((f) => f.feature);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="border-b border-border px-6 py-6 text-white"
        style={{ background: bg }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-lg font-bold">
              {org.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest opacity-80">
              {ctx.membership?.role ?? ctx.staff?.role ?? "Mitglied"}
            </div>
            <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/dashboard">Mein BODYFUEL</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-muted-foreground">
          Willkommen in deinem {org.name} Bereich. Deine persönlichen BODYFUEL Daten bleiben
          davon getrennt.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {activeFeatures.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Für diese Organisation sind noch keine Module aktiviert.
            </div>
          )}
          {activeFeatures.map((f) => (
            <div
              key={f}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Modul</div>
              <div className="mt-1 font-semibold capitalize">{f.replace(/_/g, " ")}</div>
            </div>
          ))}
        </section>

        {ctx.team_membership && (
          <section className="mt-8 rounded-lg border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Team</div>
            <div className="mt-1 text-sm">
              {ctx.team_membership.position && (
                <span className="mr-3">Position: {ctx.team_membership.position}</span>
              )}
              {ctx.team_membership.jersey_number != null && (
                <span className="mr-3">Nr. {ctx.team_membership.jersey_number}</span>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

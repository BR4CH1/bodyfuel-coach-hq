import { createFileRoute, Outlet, notFound, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrganizationBySlug, type OrganizationSummary } from "@/lib/organizations/organizations.functions";
import { OrganizationBrandProvider } from "@/lib/organizations/context";

/**
 * Auth-Weiterleitungen hängen Parameter teils ohne Trennzeichen an
 * ("/welcomeerror=access_denied&...", "/authcode=..."). Diese landeten hier im
 * dynamischen Organisations-Segment und zeigten „Diese Organisation existiert
 * nicht.". Wir reparieren solche Links, bevor die Organisation geladen wird.
 */
const AUTH_BASES = ["welcome", "auth", "login", "reset"] as const;

function repairAuthSlug(slug: string): { base: string; params: string } | null {
  for (const base of AUTH_BASES) {
    if (slug.length > base.length && slug.startsWith(base)) {
      const rest = slug.slice(base.length).replace(/^[?#&]+/, "");
      if (/^[A-Za-z0-9_]+=/.test(rest)) return { base, params: rest };
    }
  }
  return null;
}

export const Route = createFileRoute("/$orgSlug")({
  beforeLoad: ({ params }) => {
    const repaired = repairAuthSlug(params.orgSlug);
    if (repaired) {
      throw redirect({
        to: repaired.base === "welcome" ? "/welcome" : `/${repaired.base}`,
        hash: repaired.params,
        replace: true,
      } as any);
    }
  },
  loader: async ({ params }) => {
    const org = await getOrganizationBySlug({ data: { slug: params.orgSlug } });
    if (!org) throw notFound();
    return { org };
  },

  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.org.name ?? "Organisation"} — BODYFUEL` },
      { name: "description", content: `${loaderData?.org.name ?? "BODYFUEL"} auf BODYFUEL` },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-muted-foreground">
      Diese Seite konnte nicht geladen werden.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-muted-foreground">
      Diese Organisation existiert nicht.
    </div>
  ),
  component: OrgLayout,
});

function OrgLayout() {
  const { org: initialOrg } = Route.useLoaderData();
  // Keep a light refetch for logo/color updates without breaking SSR.
  const fetchOrg = useServerFn(getOrganizationBySlug);
  const { data } = useQuery({
    queryKey: ["org", initialOrg.slug],
    queryFn: () => fetchOrg({ data: { slug: initialOrg.slug } }),
    initialData: initialOrg,
  });
  const org = (data ?? initialOrg) as OrganizationSummary;
  return (
    <OrganizationBrandProvider org={org}>
      <Outlet />
    </OrganizationBrandProvider>
  );
}

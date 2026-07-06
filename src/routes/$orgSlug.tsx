import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrganizationBySlug, type OrganizationSummary } from "@/lib/organizations/organizations.functions";
import { OrganizationBrandProvider } from "@/lib/organizations/context";

export const Route = createFileRoute("/$orgSlug")({
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

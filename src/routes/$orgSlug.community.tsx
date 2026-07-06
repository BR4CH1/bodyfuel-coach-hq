import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Users } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/community")({
  component: OrgCommunity,
});

function OrgCommunity() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const fetchHome = useServerFn(getOrgHomeData);
  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });
  const primary = org.primary_color ?? "#e11d48";

  return (
    <OrgAthleteLayout slug={org.slug} features={(home?.features as any) ?? []} primaryColor={primary}>
      <header className="px-5 py-6 text-white" style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}>
        <Link to="/$orgSlug/home" params={{ orgSlug: org.slug }} className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Community</h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm text-muted-foreground">
          Der Community-Feed für {org.name} ist bald verfügbar.
        </p>
      </main>
    </OrgAthleteLayout>
  );
}

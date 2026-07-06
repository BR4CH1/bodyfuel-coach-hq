import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronLeft, Trophy } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrgRanking, getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/ranking")({
  component: OrgRanking,
});

function OrgRanking() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchRanking = useServerFn(getOrgRanking);
  const fetchHome = useServerFn(getOrgHomeData);

  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, loading, org.slug, navigate]);

  const { data } = useQuery({
    queryKey: ["org-ranking", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchRanking({ data: { slug: org.slug } }),
  });
  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  if (!data || !home) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const primary = org.primary_color ?? "#e11d48";
  const entries = data.entries as any[];

  return (
    <OrgAthleteLayout slug={org.slug} features={home.features as any} primaryColor={primary}>
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}
      >
        <Link
          to="/$orgSlug/home"
          params={{ orgSlug: org.slug }}
          className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80"
        >
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Ranking</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Noch keine Ranking-Daten. Sobald eine Challenge läuft, siehst du hier deine Platzierung.
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((e, i) => {
              const isMe = e.user_id === supabaseUser?.id;
              return (
                <li
                  key={e.user_id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    isMe ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div
                    className="grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold"
                    style={{ background: i < 3 ? primary : "hsl(var(--muted))", color: i < 3 ? "#fff" : undefined }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 text-sm font-semibold">{isMe ? "Du" : e.name}</div>
                  <div className="font-display text-sm font-bold">{e.points}</div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </OrgAthleteLayout>
  );
}

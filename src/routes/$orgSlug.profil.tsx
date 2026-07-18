import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";
import { Button } from "@/components/ui/button";
import { activatePersonalBodyFuelContext } from "@/components/organizations/OrganizationContextSwitcher";
import { UserAvatar } from "@/components/bodyfuel/UserAvatar";
import { ProfilePhotoUpload } from "@/components/bodyfuel/ProfilePhotoUpload";
import { FuelyDailyCard } from "@/components/bodyfuel/FuelyDailyCard";


export const Route = createFileRoute("/$orgSlug/profil")({
  component: OrgProfil,
});

function OrgProfil() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const entitlements = useEntitlements();
  const navigate = useNavigate();
  const fetchHome = useServerFn(getOrgHomeData);
  const qc = useQueryClient();


  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, loading, org.slug, navigate]);

  const { data } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  if (!data) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const primary = org.primary_color ?? "#e11d48";
  const tm: any = data.team_membership;
  const name = [data.profile?.display_name, null].filter(Boolean).join(" ");

  return (
    <OrgAthleteLayout slug={org.slug} features={data.features as any} primaryColor={primary}>
      <header className="px-5 py-6 text-white" style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}>
        <Link to="/$orgSlug/home" params={{ orgSlug: org.slug }} className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
            <h1 className="font-display text-2xl font-bold">Mein Profil</h1>
          </div>
          <UserAvatar
            path={(data.profile as any)?.avatar_url ?? null}
            name={name || "Athlet"}
            size={72}
            className="ring-2 ring-white/40 shrink-0"
          />
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-5 space-y-4">
        {supabaseUser && (
          <ProfilePhotoUpload
            userId={supabaseUser.id}
            currentPath={(data.profile as any)?.avatar_url ?? null}
            displayName={name || null}
            onChange={() => qc.invalidateQueries({ queryKey: ["org-home", org.slug] })}
          />
        )}
        <Row label="Name" value={name || "—"} />

        {(data.team as any) && <Row label="Team" value={(data.team as any).name} />}
        {tm?.position && <Row label="Primäre Position" value={tm.position} />}
        {tm?.secondary_position && <Row label="Zweitposition" value={tm.secondary_position} />}
        {tm?.jersey_number != null && <Row label="Trikotnummer" value={String(tm.jersey_number)} />}
        {tm?.personal_goal && <Row label="Persönliches Ziel" value={tm.personal_goal} />}
        {tm?.gym_access && <Row label="Gym-Zugang" value={tm.gym_access} />}

        {entitlements.hasAnyPersonalBodyfuel && (
          <div className="pt-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                activatePersonalBodyFuelContext();
                navigate({ to: "/dashboard" });
              }}
            >
              Zu meinem BODYFUEL wechseln
            </Button>
          </div>
        )}
      </main>
    </OrgAthleteLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

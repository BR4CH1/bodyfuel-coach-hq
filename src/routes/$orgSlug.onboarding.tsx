import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getOrganizationContext,
  completeOrganizationOnboarding,
} from "@/lib/organizations/organizations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/onboarding")({
  component: OrgOnboarding,
});

function OrgOnboarding() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getOrganizationContext);
  const complete = useServerFn(completeOrganizationOnboarding);

  useEffect(() => {
    if (!supabaseUser) navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, org.slug, navigate]);

  const { data: ctx } = useQuery({
    queryKey: ["org-ctx", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx({ data: { slug: org.slug } }),
  });

  const [teamId, setTeamId] = useState<string>("");
  const [position, setPosition] = useState("");
  const [secondaryPosition, setSecondaryPosition] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");

  useEffect(() => {
    if (ctx?.team_membership?.team_id) setTeamId(ctx.team_membership.team_id);
    else if (ctx && ctx.teams.length === 1) setTeamId(ctx.teams[0].id);
    if (ctx?.team_membership?.position) setPosition(ctx.team_membership.position);
    if (ctx?.team_membership?.secondary_position)
      setSecondaryPosition(ctx.team_membership.secondary_position);
    if (ctx?.team_membership?.jersey_number != null)
      setJerseyNumber(String(ctx.team_membership.jersey_number));
  }, [ctx]);

  const save = useMutation({
    mutationFn: async () =>
      complete({
        data: {
          organization_id: ctx!.organization.id,
          team_id: teamId || null,
          position: position || null,
          secondary_position: secondaryPosition || null,
          jersey_number: jerseyNumber ? Number(jerseyNumber) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Willkommen an Bord!");
      navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  if (!ctx) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const bg = org.primary_color ?? "#111111";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="grid h-12 w-12 place-items-center rounded-full text-white"
              style={{ background: bg }}
            >
              {org.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Onboarding</div>
            <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Deine BODYFUEL Profildaten wurden übernommen. Bitte ergänze nur die organisationsspezifischen
          Angaben.
        </p>

        <div className="grid gap-4">
          {ctx.teams.length > 0 && (
            <div>
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Team auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {ctx.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.age_group ? ` — ${t.age_group}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Position</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Zweitposition (optional)</Label>
            <Input
              value={secondaryPosition}
              onChange={(e) => setSecondaryPosition(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Trikotnummer (optional)</Label>
            <Input
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            size="lg"
            style={{ background: bg }}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Speichern…" : "Onboarding abschließen"}
          </Button>
        </div>
      </div>
    </div>
  );
}

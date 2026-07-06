import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import { completeOrganizationOnboardingV2 } from "@/lib/organizations/athlete.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/onboarding")({
  component: OrgOnboarding,
});

const GYM_OPTIONS = [
  { v: "full_gym", l: "Vollständiges Fitnessstudio" },
  { v: "limited_gym", l: "Eingeschränktes Fitnessstudio" },
  { v: "home_gym", l: "Home Gym" },
  { v: "no_gym", l: "Kein Gym" },
];

const GOAL_OPTIONS = [
  "Speed",
  "Explosiveness",
  "Strength",
  "Conditioning",
  "Robustness",
  "Overall Athletic Development",
];

const DAYS = [
  { v: 1, l: "Mo" },
  { v: 2, l: "Di" },
  { v: 3, l: "Mi" },
  { v: 4, l: "Do" },
  { v: 5, l: "Fr" },
  { v: 6, l: "Sa" },
  { v: 0, l: "So" },
];

function OrgOnboarding() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getOrganizationContext);
  const complete = useServerFn(completeOrganizationOnboardingV2);

  useEffect(() => {
    if (!supabaseUser) navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, org.slug, navigate]);

  const { data: ctx } = useQuery({
    queryKey: ["org-ctx", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx({ data: { slug: org.slug } }),
  });

  const [teamId, setTeamId] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [gym, setGym] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [limitations, setLimitations] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    if (!ctx) return;
    if (ctx.team_membership?.team_id) setTeamId(ctx.team_membership.team_id);
    else if (ctx.teams.length === 1) setTeamId(ctx.teams[0].id);
    if (ctx.team_membership?.position) setPrimary(ctx.team_membership.position);
    if (ctx.team_membership?.secondary_position) setSecondary(ctx.team_membership.secondary_position);
    if (ctx.team_membership?.jersey_number != null) setJersey(String(ctx.team_membership.jersey_number));
  }, [ctx]);

  const save = useMutation({
    mutationFn: async () => {
      if (!teamId) throw new Error("Bitte Team auswählen.");
      if (!primary) throw new Error("Bitte primäre Position angeben.");
      return complete({
        data: {
          organization_id: ctx!.organization.id,
          team_id: teamId,
          primary_position: primary,
          secondary_position: secondary || null,
          jersey_number: jersey ? Number(jersey) : null,
          gym_access: gym || null,
          available_training_days: days.length ? days : null,
          limitations: limitations || null,
          personal_goal: goal || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Willkommen bei den Bulls!");
      navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  if (!ctx) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const bg = org.primary_color ?? "#000000";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-8">
        <div className="mb-6 flex items-center gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="grid h-12 w-12 place-items-center rounded-full text-white text-sm font-bold"
              style={{ background: bg }}
            >
              {org.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Onboarding
            </div>
            <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          </div>
        </div>

        <p className="mb-6 text-xs text-muted-foreground">
          Deine BODYFUEL Basisdaten (Name, Geburtsdatum, Größe, Gewicht) wurden bereits übernommen.
          Bitte ergänze nur die organisationsspezifischen Angaben.
        </p>

        <div className="grid gap-4">
          {ctx.teams.length > 0 && (
            <Field label="Team *">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Team auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {ctx.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Primary Position *">
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="z.B. Linebacker" />
          </Field>
          <Field label="Secondary Position (optional)">
            <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </Field>
          <Field label="Trikotnummer (optional)">
            <Input type="number" value={jersey} onChange={(e) => setJersey(e.target.value)} />
          </Field>
          <Field label="Gym Access">
            <Select value={gym} onValueChange={setGym}>
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                {GYM_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Verfügbare Athletik-Trainingstage">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() =>
                      setDays((cur) => (cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]))
                    }
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase ${
                      on ? "border-transparent text-white" : "border-border bg-card"
                    }`}
                    style={on ? { background: bg } : {}}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Sports Limitations / Aktuelle Einschränkungen">
            <Textarea
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              placeholder="Freitext — keine medizinische Diagnose."
              rows={3}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Hinweis: Keine medizinische Diagnosefunktion.
            </p>
          </Field>
          <Field label="Personal Athletic Goal">
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger>
                <SelectValue placeholder="Ziel wählen" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            size="lg"
            className="text-white"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

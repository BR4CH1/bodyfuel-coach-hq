import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import {
  completeOrganizationOnboardingV2,
  completeStaffOrganizationOnboarding,
} from "@/lib/organizations/athlete.functions";
import { deriveOrgRole } from "@/lib/organizations/org-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/onboarding")({
  component: OrgOnboardingDispatcher,
});

const GYM_OPTIONS = [
  { v: "full_gym", l: "Vollständiges Fitnessstudio" },
  { v: "limited_gym", l: "Eingeschränktes Fitnessstudio" },
  { v: "home_gym", l: "Home Gym" },
  { v: "no_gym", l: "Kein Gym" },
];

const GOAL_OPTIONS: { v: string; l: string }[] = [
  { v: "Speed", l: "Schnelligkeit" },
  { v: "Explosiveness", l: "Explosivität" },
  { v: "Strength", l: "Kraft" },
  { v: "Conditioning", l: "Kondition" },
  { v: "Robustness", l: "Verletzungsprävention / Robustheit" },
  { v: "Overall Athletic Development", l: "Athletische Grundlagen (Allround)" },
];

// Performance Nutrition Engine V1 — org-scoped Energie-/Zielparameter.
// Wichtig: getrennt vom persönlichen BodyFuel-Smart-Kontext.
const ENERGY_SEX_OPTIONS = [
  { v: "MALE", l: "Männlich" },
  { v: "FEMALE", l: "Weiblich" },
  { v: "UNSPECIFIED", l: "Keine Angabe (Coach-Review nötig)" },
] as const;

const BASELINE_ACTIVITY_OPTIONS = [
  { v: "MOSTLY_SEATED", l: "Überwiegend sitzend (Büro/Schule)" },
  { v: "MIXED", l: "Gemischt (teils sitzend, teils aktiv)" },
  { v: "PHYSICALLY_ACTIVE", l: "Körperlich aktiv (viel auf den Beinen)" },
  { v: "VERY_PHYSICALLY_ACTIVE", l: "Sehr körperlich aktiv (Bau/Handwerk)" },
] as const;

const PERFORMANCE_NUTRITION_GOAL_OPTIONS = [
  { v: "FAT_LOSS", l: "Körperfett reduzieren" },
  { v: "MAINTENANCE", l: "Gewicht halten" },
  { v: "PERFORMANCE", l: "Leistung / Performance" },
  { v: "MUSCLE_GAIN", l: "Muskelaufbau" },
] as const;

// Sichtbare Funktions-Labels. Diese Auswahl ist rein kosmetisch — die
// technische Rolle (`staff_assignments.role`) wird ausschließlich über die
// Einladung/den Vereinsgründungspfad gesetzt und hier NICHT geändert.
// Wir zeigen deshalb nur solche Labels, die zur tatsächlichen Rolle passen.
const STAFF_FUNCTION_OPTIONS_COACH = [
  "Head Coach",
  "Offensive Coordinator",
  "Defensive Coordinator",
  "Positionscoach Offense",
  "Positionscoach Defense",
  "Special Teams Coach",
  "Athletik- / Strength & Conditioning Coach",
  "Player Care / Medical",
  "Sonstige",
];
const STAFF_FUNCTION_OPTIONS_ORG_ADMIN = [
  "Vereinsleitung",
  "1. Vorsitz",
  "2. Vorsitz",
  "Sportlicher Leiter",
  "Geschäftsstelle",
  "Sonstige",
];
const STAFF_FUNCTION_OPTIONS_STAFF = [
  "Player Care / Medical",
  "Video-Analyst",
  "Team-Manager",
  "Sonstige",
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

function OrgOnboardingDispatcher() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getOrganizationContext);

  useEffect(() => {
    if (!supabaseUser) navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, org.slug, navigate]);

  const { data: ctx } = useQuery({
    queryKey: ["org-ctx", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCtx({ data: { slug: org.slug } }),
  });

  const flags = useMemo(() => {
    if (!ctx) return null;
    return deriveOrgRole({
      membership: ctx.membership,
      staff: ctx.staff,
      is_super_admin: ctx.is_super_admin,
    });
  }, [ctx]);

  // Wenn keine Membership/Staff → zurück zur Org-Landing
  useEffect(() => {
    if (!ctx) return;
    if (!ctx.membership && !ctx.staff && !ctx.is_super_admin) {
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
    }
  }, [ctx, navigate, org.slug]);

  if (!ctx || !flags) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;
  }

  // Athleten-Flow gilt nur, wenn Player-Rolle vorliegt.
  if (flags.isPlayer) {
    return <AthleteOnboarding ctx={ctx} />;
  }

  // Sonst Staff-Flow (Coach, Head Coach, Vereinsleitung, Staff)
  if (flags.isAnyStaff) {
    return <StaffOnboarding ctx={ctx} />;
  }

  // Nur SuperAdmin ohne Zuordnung → direkt weiter
  navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  return null;
}

// ---------------------------------------------------------------------------
// Athleten-Onboarding
// ---------------------------------------------------------------------------

function AthleteOnboarding({ ctx }: { ctx: NonNullable<Awaited<ReturnType<typeof getOrganizationContext>>> }) {
  const { org } = OrgLayoutRoute.useLoaderData();
  const navigate = useNavigate();
  const complete = useServerFn(completeOrganizationOnboardingV2);

  const [displayName, setDisplayName] = useState(ctx.profile?.display_name ?? "");
  const [birthdate, setBirthdate] = useState(ctx.profile?.birthdate ?? "");
  const [heightCm, setHeightCm] = useState<string>(
    ctx.profile?.height_cm ? String(ctx.profile.height_cm) : "",
  );
  const [weightKg, setWeightKg] = useState<string>("");

  const [teamId, setTeamId] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [gym, setGym] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [limitations, setLimitations] = useState("");
  const [goal, setGoal] = useState("");

  // Performance Nutrition Engine V1 — org-scoped
  const [energySex, setEnergySex] = useState<string>("");
  const [baselineActivity, setBaselineActivity] = useState<string>("");
  const [nutritionGoal, setNutritionGoal] = useState<string>("");

  useEffect(() => {
    const tm: any = ctx.team_membership;
    if (tm?.team_id) setTeamId(tm.team_id);
    else if (ctx.teams.length === 1) setTeamId(ctx.teams[0].id);
    if (tm?.position) setPrimary(tm.position);
    if (tm?.secondary_position) setSecondary(tm.secondary_position);
    if (tm?.jersey_number != null) setJersey(String(tm.jersey_number));
    if (tm?.gym_access) setGym(tm.gym_access);
    if (Array.isArray(tm?.available_training_days)) setDays(tm.available_training_days);
    if (tm?.limitations) setLimitations(tm.limitations);
    if (tm?.personal_goal) setGoal(tm.personal_goal);
  }, [ctx]);

  const save = useMutation({
    mutationFn: async () => {
      if (!displayName.trim()) throw new Error("Bitte Namen angeben.");
      if (!birthdate) throw new Error("Bitte Geburtsdatum angeben.");
      if (!heightCm || Number(heightCm) < 100) throw new Error("Bitte Größe in cm angeben.");
      if (!weightKg || Number(weightKg) < 30) throw new Error("Bitte aktuelles Gewicht in kg angeben.");
      if (!teamId) throw new Error("Bitte Team auswählen.");
      if (!primary) throw new Error("Bitte primäre Position angeben.");
      return complete({
        data: {
          organization_id: ctx.organization.id,
          team_id: teamId,
          primary_position: primary,
          secondary_position: secondary || null,
          jersey_number: jersey ? Number(jersey) : null,
          gym_access: gym || null,
          available_training_days: days.length ? days : null,
          limitations: limitations || null,
          personal_goal: goal || null,
          display_name: displayName.trim(),
          birthdate: birthdate,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
        },
      });
    },
    onSuccess: () => {
      toast.success(`Willkommen bei ${org.name}!`);
      navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug }, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  const bg = org.primary_color ?? "#000000";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-8 pb-32">
        <OnboardingHeader title={org.name} subtitle="Athleten-Onboarding" />
        <p className="mb-6 text-xs text-muted-foreground">
          Willkommen im {org.name}-Bereich. Bitte vervollständige deine Basisdaten sowie deine
          Position im Team.
        </p>

        <SectionHeader>Basisdaten</SectionHeader>
        <div className="grid gap-4">
          <Field label="Name *">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vor- und Nachname" />
          </Field>
          <Field label="Geburtsdatum *">
            <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Größe (cm) *">
              <Input type="number" inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="z.B. 182" />
            </Field>
            <Field label="Gewicht (kg) *">
              <Input type="number" inputMode="decimal" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="aktuell" />
            </Field>
          </div>
        </div>

        <SectionHeader className="mt-6">Team & Position</SectionHeader>
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
          <Field label="Primäre Position *">
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="z.B. Linebacker" />
          </Field>
          <Field label="Zweitposition (optional)">
            <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </Field>
          <Field label="Trikotnummer (optional)">
            <Input type="number" value={jersey} onChange={(e) => setJersey(e.target.value)} />
          </Field>
        </div>

        <SectionHeader className="mt-6">Training</SectionHeader>
        <div className="grid gap-4">
          <Field label="Gym-Zugang">
            <Select value={gym} onValueChange={setGym}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
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
                    onClick={() => setDays((cur) => (cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]))}
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
          <Field label="Aktuelle körperliche Einschränkungen (optional)">
            <Textarea
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              placeholder="Freitext — keine medizinische Diagnose."
              rows={3}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Hinweis: Keine medizinische Diagnosefunktion.</p>
          </Field>
          <Field label="Persönliches Athletik-Ziel">
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger><SelectValue placeholder="Ziel wählen" /></SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full text-white"
          style={{ background: bg }}
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Speichern…" : "Onboarding abschließen"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff-/Coach-Onboarding
// ---------------------------------------------------------------------------

function StaffOnboarding({ ctx }: { ctx: NonNullable<Awaited<ReturnType<typeof getOrganizationContext>>> }) {
  const { org } = OrgLayoutRoute.useLoaderData();
  const navigate = useNavigate();
  const complete = useServerFn(completeStaffOrganizationOnboarding);

  const [displayName, setDisplayName] = useState(ctx.profile?.display_name ?? "");
  const [birthdate, setBirthdate] = useState(ctx.profile?.birthdate ?? "");
  const [nickname, setNickname] = useState(ctx.profile?.nickname ?? "");
  const [functionLabel, setFunctionLabel] = useState(ctx.staff?.function_label ?? "");
  const [functionCustom, setFunctionCustom] = useState("");

  const staffOptions = useMemo<string[]>(() => {
    const role = ctx.staff?.role;
    if (role === "organization_admin") return STAFF_FUNCTION_OPTIONS_ORG_ADMIN;
    if (role === "coach") return STAFF_FUNCTION_OPTIONS_COACH;
    return STAFF_FUNCTION_OPTIONS_STAFF;
  }, [ctx.staff?.role]);

  const save = useMutation({
    mutationFn: async () => {
      if (!displayName.trim()) throw new Error("Bitte Namen angeben.");
      const label =
        functionLabel === "Sonstige"
          ? functionCustom.trim() || null
          : functionLabel || null;
      return complete({
        data: {
          organization_id: ctx.organization.id,
          display_name: displayName.trim(),
          nickname: nickname.trim() || null,
          birthdate: birthdate || null,
          function_label: label,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Willkommen bei ${org.name}!`);
      navigate({ to: "/coach/teams/$orgId", params: { orgId: ctx.organization.id }, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  const bg = org.primary_color ?? "#000000";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-8 pb-32">
        <OnboardingHeader title={org.name} subtitle="Staff-Onboarding" />
        <p className="mb-6 text-xs text-muted-foreground">
          Willkommen im Coach-Bereich von {org.name}. Bitte hinterlege deine Basisdaten und deine
          Rolle im Verein. Es werden keine athletischen Werte (Größe, Gewicht, Trainingsziele)
          erfasst – dieser Bereich ist rein organisatorisch.
        </p>

        <SectionHeader>Basisdaten</SectionHeader>
        <div className="grid gap-4">
          <Field label="Name *">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vor- und Nachname" />
          </Field>
          <Field label="Rufname (optional)">
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="wie du im Team gerufen wirst" />
          </Field>
          <Field label="Geburtsdatum (optional)">
            <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          </Field>
        </div>

        <SectionHeader className="mt-6">Funktion im Team</SectionHeader>
        <div className="grid gap-4">
          <Field label="Rolle / Funktion">
            <Select value={functionLabel} onValueChange={setFunctionLabel}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {staffOptions.map((o: string) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Nur zur Anzeige im Coach-Cockpit. Deine Berechtigungen werden dadurch nicht verändert.
            </p>
          </Field>
          {functionLabel === "Sonstige" && (
            <Field label="Deine Funktion">
              <Input
                value={functionCustom}
                onChange={(e) => setFunctionCustom(e.target.value)}
                placeholder="z.B. Video-Analyst"
              />
            </Field>
          )}
        </div>

        <Button
          size="lg"
          className="mt-8 w-full text-white"
          style={{ background: bg }}
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Speichern…" : "Onboarding abschließen"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------------------

function OnboardingHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { org } = OrgLayoutRoute.useLoaderData();
  const bg = org.primary_color ?? "#000000";
  return (
    <div className="mb-6 flex items-center gap-3">
      {org.logo_url ? (
        <img src={org.logo_url} alt={title} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div
          className="grid h-12 w-12 place-items-center rounded-full text-white text-sm font-bold"
          style={{ background: bg }}
        >
          {title.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {subtitle}
        </div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
      </div>
    </div>
  );
}

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground ${className ?? ""}`}>
      {children}
    </h2>
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

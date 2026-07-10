import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import {
  completeOrganizationOnboardingV2,
  completeStaffOrganizationOnboarding,
} from "@/lib/organizations/athlete.functions";
import { savePerformanceNutritionPreferences } from "@/lib/performance-nutrition/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
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


// --- Persönliche Ernährungspräferenzen (SNP-Chips wiederverwendet) ---
const FAVORITE_FOODS_CHIPS = [
  "Hähnchen", "Rind", "Pute", "Eier", "Skyr", "Fisch", "Reis", "Nudeln",
  "Kartoffeln", "Wraps", "Haferflocken", "Obst", "Gemüse", "Käse", "Nüsse", "Proteinpulver",
];
const ALLERGY_CHIPS = ["Laktose", "Gluten", "Nüsse", "Soja", "Ei", "Fisch", "Meeresfrüchte"];
const INTOLERANCE_CHIPS = ["Fructose", "Histamin", "Sorbit", "FODMAP"];
const DIET_STYLE_OPTIONS = [
  { v: "omnivore", l: "Alles / Omnivor" },
  { v: "flexitarian", l: "Flexitarisch (selten Fleisch)" },
  { v: "pescetarian", l: "Pescetarisch (Fisch, kein Fleisch)" },
  { v: "vegetarian", l: "Vegetarisch" },
  { v: "vegan", l: "Vegan" },
  { v: "other", l: "Andere / Sonstige" },
] as const;
const EATING_STYLE_OPTIONS = [
  { v: "meal_prep", l: "Meal Prep (viel vorkochen)" },
  { v: "fresh", l: "Frisch täglich zubereiten" },
  { v: "mixed", l: "Gemischt" },
] as const;
const MEAL_PREP_STYLE_OPTIONS = [
  { v: "daily", l: "Täglich frisch kochen" },
  { v: "2_3_week", l: "2-3x pro Woche kochen" },
  { v: "meal_prep", l: "Meal Prep für die ganze Woche" },
  { v: "low_effort", l: "So wenig kochen wie möglich" },
] as const;

// Auto-Ableitung: profiles.gender → sex_for_energy_calculation.
function deriveEnergySex(gender: string | null | undefined): "MALE" | "FEMALE" | "UNSPECIFIED" {
  if (gender === "male") return "MALE";
  if (gender === "female") return "FEMALE";
  return "UNSPECIFIED";
}

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
  const { supabaseUser } = useSession();
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

  // Persönliche Ernährungspräferenzen (source of truth: smart_nutrition_profile)
  const [favFoods, setFavFoods] = useState<string[]>([]);
  const [extraFavs, setExtraFavs] = useState<string>("");
  const [nogoFoods, setNogoFoods] = useState<string[]>([]);
  const [extraNogos, setExtraNogos] = useState<string>("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [extraAllergies, setExtraAllergies] = useState<string>("");
  const [intolerances, setIntolerances] = useState<string[]>([]);
  const [dietStyle, setDietStyle] = useState<string>("");
  const [dietNotes, setDietNotes] = useState<string>("");
  const [eatingStyle, setEatingStyle] = useState<string>("");
  const [mealPrepStyle, setMealPrepStyle] = useState<string>("");
  const [allergiesTouched, setAllergiesTouched] = useState(false);
  const [intolerancesTouched, setIntolerancesTouched] = useState(false);

  const savePrefs = useServerFn(savePerformanceNutritionPreferences);

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
    // Auto-Ableitung: Geschlecht aus profiles → Energieberechnung.
    const g = (ctx.profile as { gender?: string | null } | null)?.gender ?? null;
    if (g) setEnergySex(deriveEnergySex(g));
  }, [ctx]);

  // Prefill der SNP-Präferenzen (falls Athlet bereits Smart-Onboarding hatte).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: snp } = await supabase
        .from("smart_nutrition_profile")
        .select(
          "favorite_foods, extra_favorites, nogo_foods, extra_nogos, allergies, extra_allergies, intolerances, diet_style, diet_notes, eating_style, meal_prep_style",
        )
        .eq("user_id", supabaseUser?.id ?? "")
        .maybeSingle();
      if (cancelled || !snp) return;
      const s = snp as Record<string, any>;
      if (Array.isArray(s.favorite_foods)) setFavFoods(s.favorite_foods);
      if (s.extra_favorites) setExtraFavs(s.extra_favorites);
      if (Array.isArray(s.nogo_foods)) setNogoFoods(s.nogo_foods);
      if (s.extra_nogos) setExtraNogos(s.extra_nogos);
      if (Array.isArray(s.allergies)) { setAllergies(s.allergies); setAllergiesTouched(true); }
      if (s.extra_allergies) setExtraAllergies(s.extra_allergies);
      if (Array.isArray(s.intolerances)) { setIntolerances(s.intolerances); setIntolerancesTouched(true); }
      if (s.diet_style) setDietStyle(s.diet_style);
      if (s.diet_notes) setDietNotes(s.diet_notes);
      if (s.eating_style) setEatingStyle(s.eating_style);
      if (s.meal_prep_style) setMealPrepStyle(s.meal_prep_style);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser?.id]);

  const isGym = (ctx.organization as { organization_type?: string }).organization_type === "fitness_studio";

  const save = useMutation({
    mutationFn: async () => {
      if (!displayName.trim()) throw new Error("Bitte Namen angeben.");
      if (!birthdate) throw new Error("Bitte Geburtsdatum angeben.");
      if (!heightCm || Number(heightCm) < 100) throw new Error("Bitte Größe in cm angeben.");
      if (!weightKg || Number(weightKg) < 30) throw new Error("Bitte aktuelles Gewicht in kg angeben.");
      // Team/Position sind nur bei Sportvereinen Pflicht. Fitnessstudios
      // brauchen keine Mannschaft und keine Spielerposition.
      if (!isGym) {
        if (!teamId) throw new Error("Bitte Team auswählen.");
        if (!primary) throw new Error("Bitte primäre Position angeben.");
      }
      if (!energySex) throw new Error("Bitte Angabe zum biologischen Geschlecht für die Energieberechnung.");
      if (!baselineActivity) throw new Error("Bitte Alltagsaktivität angeben.");
      if (!nutritionGoal) throw new Error("Bitte Ernährungsziel angeben.");
      if (!dietStyle) throw new Error("Bitte Ernährungsform angeben.");
      if (!mealPrepStyle) throw new Error("Bitte angeben, wie du kochen willst.");
      if (!allergiesTouched) throw new Error("Bitte bestätige, ob du Allergien hast (auch ohne Auswahl).");
      if (!intolerancesTouched) throw new Error("Bitte bestätige, ob du Unverträglichkeiten hast (auch ohne Auswahl).");

      // 1) Basisdaten + PNP-Engine-Felder + org membership.
      await complete({
        data: {
          organization_id: ctx.organization.id,
          team_id: isGym ? (teamId || null) : teamId,
          primary_position: isGym ? null : primary,
          secondary_position: isGym ? null : (secondary || null),
          jersey_number: isGym ? null : (jersey ? Number(jersey) : null),
          gym_access: gym || null,
          available_training_days: days.length ? days : null,
          limitations: limitations || null,
          personal_goal: goal || null,

          display_name: displayName.trim(),
          birthdate: birthdate,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          sex_for_energy_calculation: energySex as "MALE" | "FEMALE" | "UNSPECIFIED",
          baseline_daily_activity: baselineActivity as
            | "MOSTLY_SEATED"
            | "MIXED"
            | "PHYSICALLY_ACTIVE"
            | "VERY_PHYSICALLY_ACTIVE",
          performance_nutrition_goal: nutritionGoal as
            | "FAT_LOSS"
            | "MAINTENANCE"
            | "PERFORMANCE"
            | "MUSCLE_GAIN",
        },
      });

      // 2) Persönliche Nutrition-Präferenzen (SNP) — sparse upsert.
      await savePrefs({
        data: {
          organizationId: ctx.organization.id,
          favorite_foods: favFoods,
          extra_favorites: extraFavs || null,
          nogo_foods: nogoFoods,
          extra_nogos: extraNogos || null,
          allergies: allergies,
          extra_allergies: extraAllergies || null,
          intolerances: intolerances,
          diet_style: dietStyle,
          diet_notes: dietNotes || null,
          eating_style: eatingStyle || null,
          meal_prep_style: mealPrepStyle,
        },
      });
      return { ok: true };
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

        {isGym ? (
          ctx.teams.length > 0 ? (
            <>
              <SectionHeader className="mt-6">Gruppe (optional)</SectionHeader>
              <div className="grid gap-4">
                <Field label="Gruppe">
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional — Gruppe auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {ctx.teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          ) : null
        ) : (
          <>
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
          </>
        )}


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

        <SectionHeader className="mt-6">Ernährung & Aktivität</SectionHeader>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Grundlage für dein persönliches Kalorien- und Makro-Ziel im {org.name}-Bereich.
          Diese Angaben fließen ausschließlich in die vereinsinterne Performance-Berechnung ein.
        </p>
        <div className="grid gap-4">
          <Field label="Biologisches Geschlecht (für Energieberechnung) *">
            <Select value={energySex} onValueChange={setEnergySex}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {ENERGY_SEX_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Wird nur zur Berechnung des Energiebedarfs verwendet (DRI 2023).
            </p>
          </Field>
          <Field label="Alltagsaktivität (ohne Football-/Athletik-Training) *">
            <Select value={baselineActivity} onValueChange={setBaselineActivity}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {BASELINE_ACTIVITY_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ernährungsziel *">
            <Select value={nutritionGoal} onValueChange={setNutritionGoal}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {PERFORMANCE_NUTRITION_GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SectionHeader className="mt-6">Ernährungsform</SectionHeader>
        <div className="grid gap-4">
          <Field label="Wie ernährst du dich? *">
            <Select value={dietStyle} onValueChange={setDietStyle}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {DIET_STYLE_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Anmerkungen zur Ernährung (optional)">
            <Textarea value={dietNotes} onChange={(e) => setDietNotes(e.target.value)} rows={2} placeholder="z.B. wenig Rotes Fleisch, kein Schweinefleisch..." />
          </Field>
        </div>

        <SectionHeader className="mt-6">Lieblingsfoods</SectionHeader>
        <div className="grid gap-3">
          <Field label="Was isst du besonders gerne?">
            <ChipGrid items={FAVORITE_FOODS_CHIPS} selected={favFoods} onChange={setFavFoods} bg={bg} />
          </Field>
          <Field label="Weitere Lieblingsfoods (optional)">
            <Textarea value={extraFavs} onChange={(e) => setExtraFavs(e.target.value)} rows={2} placeholder="Kommagetrennt: z.B. Süßkartoffel, Linsen, Tofu" />
          </Field>
        </div>

        <SectionHeader className="mt-6">Was du NICHT essen willst</SectionHeader>
        <div className="grid gap-3">
          <Field label="No-Gos aus der Liste">
            <ChipGrid items={FAVORITE_FOODS_CHIPS} selected={nogoFoods} onChange={setNogoFoods} bg={bg} />
          </Field>
          <Field label="Weitere No-Gos (optional)">
            <Textarea value={extraNogos} onChange={(e) => setExtraNogos(e.target.value)} rows={2} placeholder="Kommagetrennt: z.B. Rosenkohl, Sellerie" />
          </Field>
        </div>

        <SectionHeader className="mt-6">Allergien & Unverträglichkeiten</SectionHeader>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Sicherheitsrelevant — dein Plan wird streng gefiltert. Wenn du keine hast, wähle einfach nichts aus und tippe auf „Keine Allergien / Unverträglichkeiten".
        </p>
        <div className="grid gap-3">
          <Field label="Allergien">
            <ChipGrid items={ALLERGY_CHIPS} selected={allergies} onChange={(v) => { setAllergies(v); setAllergiesTouched(true); }} bg={bg} />
          </Field>
          <Field label="Weitere Allergien (optional)">
            <Input value={extraAllergies} onChange={(e) => setExtraAllergies(e.target.value)} placeholder="Kommagetrennt" />
          </Field>
          <Field label="Unverträglichkeiten">
            <ChipGrid items={INTOLERANCE_CHIPS} selected={intolerances} onChange={(v) => { setIntolerances(v); setIntolerancesTouched(true); }} bg={bg} />
          </Field>
          {(!allergiesTouched || !intolerancesTouched) && (
            <button
              type="button"
              onClick={() => { setAllergies([]); setAllergiesTouched(true); setIntolerances([]); setIntolerancesTouched(true); }}
              className="mt-1 self-start rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              Keine Allergien / Unverträglichkeiten
            </button>
          )}
        </div>

        <SectionHeader className="mt-6">Essalltag & Meal Prep</SectionHeader>
        <div className="grid gap-4">
          <Field label="Wie möchtest du deine Mahlzeiten vorbereiten? *">
            <Select value={mealPrepStyle} onValueChange={setMealPrepStyle}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {MEAL_PREP_STYLE_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Grundsätzlicher Essalltag (optional)">
            <Select value={eatingStyle} onValueChange={setEatingStyle}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {EATING_STYLE_OPTIONS.map((o) => (
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

function ChipGrid({
  items,
  selected,
  onChange,
  bg,
}: {
  items: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  bg: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.includes(it);
        return (
          <button
            key={it}
            type="button"
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== it) : [...selected, it])
            }
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
              on ? "border-transparent text-white" : "border-border bg-card"
            }`}
            style={on ? { background: bg } : {}}
          >
            {it}
          </button>
        );
      })}
    </div>
  );
}

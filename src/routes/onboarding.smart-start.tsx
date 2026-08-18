import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Loader2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Target,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/bodyfuel/Logo";
import { SmartLockCard } from "@/components/bodyfuel/SmartGate";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlement } from "@/hooks/use-entitlement";
import {
  completeSmartOnboarding,
  getOnboardingStatus,
} from "@/lib/smart-onboarding.functions";
import { getMyAutopilotJob } from "@/lib/autopilot-jobs.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/smart-start")({
  head: () => ({
    meta: [
      { title: "Smart Start — BODYFUEL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuidedSmartStartPage,
});

const GOALS = [
  { v: "fat_loss", l: "Abnehmen" },
  { v: "lean_bulk", l: "Muskelaufbau" },
  { v: "performance", l: "Performance" },
  { v: "recomp", l: "Recomposition" },
] as const;

const EXPERIENCE = [
  { v: "beginner", l: "Anfänger" },
  { v: "intermediate", l: "Fortgeschritten" },
  { v: "advanced", l: "Experte" },
] as const;

const LOCATIONS = [
  { v: "gym", l: "Fitnessstudio" },
  { v: "home_gym", l: "Home Gym" },
  { v: "home", l: "Zuhause" },
] as const;

const EQUIPMENT = [
  { v: "machines", l: "Geräte" },
  { v: "free_weights", l: "Freihanteln" },
  { v: "both", l: "Beides" },
] as const;

const WEEKDAYS = [
  { v: "monday", l: "Mo" },
  { v: "tuesday", l: "Di" },
  { v: "wednesday", l: "Mi" },
  { v: "thursday", l: "Do" },
  { v: "friday", l: "Fr" },
  { v: "saturday", l: "Sa" },
  { v: "sunday", l: "So" },
] as const;

const DURATIONS = [30, 45, 60, 90];

const EATING_STYLES = [
  { v: "meal_prep", l: "Meal Prep" },
  { v: "fresh", l: "Frisch kochen" },
  { v: "mixed", l: "Gemischt" },
] as const;

const PREP_DAYS = [2, 3, 4, 5, 7];

const SHOPPING = [
  { v: "daily", l: "Täglich", days: ["monday", "wednesday", "friday", "sunday"], lead: 0 },
  { v: "two", l: "Alle 2 Tage", days: ["monday", "wednesday", "friday"], lead: 2 },
  { v: "three", l: "Alle 3 Tage", days: ["monday", "thursday"], lead: 3 },
  { v: "weekly", l: "Wöchentlich", days: ["saturday"], lead: 6 },
] as const;

const BUDGETS = [
  { v: "<50", l: "Sparsam" },
  { v: "50_75", l: "Normal" },
  { v: "75_100", l: "Komfort" },
  { v: ">100", l: "Premium" },
] as const;

const VARIETY = [
  { v: "low", l: "Wenig" },
  { v: "medium", l: "Mittel" },
  { v: "high", l: "Hoch" },
] as const;

const DIET_STYLES = [
  { v: "omnivore", l: "Alles" },
  { v: "flexitarian", l: "Flexitarisch" },
  { v: "pescetarian", l: "Pescetarisch" },
  { v: "vegetarian", l: "Vegetarisch" },
  { v: "vegan", l: "Vegan" },
  { v: "other", l: "Andere" },
] as const;

const FAVORITES = [
  "Hähnchen",
  "Rind",
  "Pute",
  "Eier",
  "Skyr",
  "Fisch",
  "Reis",
  "Nudeln",
  "Kartoffeln",
  "Wraps",
  "Haferflocken",
  "Obst",
  "Gemüse",
  "Käse",
  "Nüsse",
  "Proteinpulver",
];

const ALLERGIES = ["Laktose", "Gluten", "Nüsse", "Soja", "Ei", "Fisch", "Meeresfrüchte"];
const INTOLERANCES = ["Fructose", "Histamin", "Sorbit", "FODMAP"];

const STEP_META = [
  { title: "Deine Basis", text: "Damit Kalorien, Makros und Zielrichtung wirklich zu dir passen.", icon: Activity },
  { title: "Dein Ziel", text: "Smart braucht eine klare Richtung, bevor ein Plan sinnvoll werden kann.", icon: Target },
  { title: "Dein Training", text: "Trainingstage und Rahmenbedingungen beeinflussen auch deinen Ernährungsplan.", icon: Dumbbell },
  { title: "Dein Ernährungsalltag", text: "Der Plan soll in deinen Alltag und dein Budget passen – nicht umgekehrt.", icon: ShoppingBasket },
  { title: "Was du gerne isst", text: "Je genauer deine Vorlieben sind, desto weniger Standardgerichte bekommst du.", icon: Utensils },
  { title: "Sicher & passend", text: "Allergien und Unverträglichkeiten haben Vorrang vor jeder Empfehlung.", icon: ShieldCheck },
] as const;

type Form = {
  height_cm: string;
  gender: "" | "male" | "female" | "other";
  birthdate: string;
  weight_kg: string;
  goal_weight_kg: string;
  training_goal: "" | "fat_loss" | "lean_bulk" | "performance" | "recomp";
  training_experience: "" | "beginner" | "intermediate" | "advanced";
  training_location: "" | "gym" | "home_gym" | "home";
  training_equipment: "" | "machines" | "free_weights" | "both";
  training_weekdays: string[];
  training_duration_min: number | null;
  eating_style: "" | "meal_prep" | "fresh" | "mixed";
  meal_prep_days: number | null;
  shopping_days: string[];
  shopping_lead_days: number;
  budget_band: "" | "<50" | "50_75" | "75_100" | ">100";
  weekly_budget_eur: string;
  variety_level: "" | "low" | "medium" | "high";
  favorite_foods: string[];
  extra_favorites: string;
  extra_nogos: string;
  allergies: string[];
  intolerances: string[];
  extra_allergies: string;
  diet_style: "" | "omnivore" | "flexitarian" | "pescetarian" | "vegetarian" | "vegan" | "other";
  diet_notes: string;
};

const EMPTY: Form = {
  height_cm: "",
  gender: "",
  birthdate: "",
  weight_kg: "",
  goal_weight_kg: "",
  training_goal: "",
  training_experience: "",
  training_location: "",
  training_equipment: "",
  training_weekdays: [],
  training_duration_min: null,
  eating_style: "",
  meal_prep_days: null,
  shopping_days: [],
  shopping_lead_days: 2,
  budget_band: "",
  weekly_budget_eur: "",
  variety_level: "",
  favorite_foods: [],
  extra_favorites: "",
  extra_nogos: "",
  allergies: [],
  intolerances: [],
  extra_allergies: "",
  diet_style: "",
  diet_notes: "",
};

function GuidedSmartStartPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { supabaseUser, loading } = useSession();
  const { hasSmart, loading: entitlementLoading } = useEntitlement();
  const statusFn = useServerFn(getOnboardingStatus);
  const completeFn = useServerFn(completeSmartOnboarding);
  const jobFn = useServerFn(getMyAutopilotJob);

  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (!loading && !supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined }, replace: true });
    }
  }, [loading, supabaseUser, navigate]);

  useEffect(() => {
    if (!supabaseUser) return;
    supabase
      .from("profiles")
      .select("height_cm,gender,birthdate,goal_weight_kg,training_goal")
      .eq("id", supabaseUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setForm((current) => ({
          ...current,
          height_cm: data.height_cm?.toString() ?? current.height_cm,
          gender: (data.gender as Form["gender"]) ?? current.gender,
          birthdate: data.birthdate ?? current.birthdate,
          goal_weight_kg: data.goal_weight_kg?.toString() ?? current.goal_weight_kg,
          training_goal: (data.training_goal as Form["training_goal"]) ?? current.training_goal,
        }));
      });
  }, [supabaseUser]);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["smart-onboarding-status"],
    queryFn: () => statusFn(),
    enabled: !!supabaseUser && hasSmart,
    staleTime: 15_000,
  });

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["smart-autopilot-job"],
    queryFn: () => jobFn(),
    enabled: !!supabaseUser && hasSmart && (submitted || !!status?.completed),
    refetchInterval: 3_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await completeFn({
        data: {
          height_cm: form.height_cm ? Number(form.height_cm) : null,
          gender: form.gender || null,
          birthdate: form.birthdate || null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg) : null,
          training_goal: form.training_goal || null,
          training_experience: form.training_experience || null,
          training_location: form.training_location || null,
          training_equipment: form.training_equipment || null,
          training_weekdays: form.training_weekdays,
          training_duration_min: form.training_duration_min,
          eating_style: form.eating_style || null,
          meal_prep_days: form.eating_style === "meal_prep" ? form.meal_prep_days : null,
          shopping_days: form.shopping_days,
          shopping_lead_days: form.shopping_lead_days,
          budget_band: form.budget_band || null,
          weekly_budget_eur: form.weekly_budget_eur ? Number(form.weekly_budget_eur) : null,
          variety_level: form.variety_level || null,
          favorite_foods: form.favorite_foods,
          nogo_foods: [],
          allergies: form.allergies,
          intolerances: form.intolerances,
          extra_favorites: form.extra_favorites || null,
          extra_nogos: form.extra_nogos || null,
          extra_allergies: form.extra_allergies || null,
          diet_style: form.diet_style || null,
          diet_notes: form.diet_notes || null,
        },
      });
      if (!result.queued) {
        throw new Error(result.errors?.join(" · ") || "Die Plan-Erstellung konnte nicht gestartet werden.");
      }
      return result;
    },
    onSuccess: async () => {
      setSubmitted(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["smart-onboarding-status"] }),
        qc.invalidateQueries({ queryKey: ["smart-autopilot-job"] }),
      ]);
    },
  });

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggle = (key: "training_weekdays" | "favorite_foods" | "allergies" | "intolerances", value: string) => {
    const current = form[key];
    update(key, (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) as Form[typeof key]);
  };

  if (!entitlementLoading && supabaseUser && !hasSmart) {
    return (
      <div className="mx-auto max-w-md p-6">
        <SmartLockCard title="Smart Start" />
      </div>
    );
  }

  if (loading || entitlementLoading || (hasSmart && statusLoading)) {
    return <LoadingScreen text="Smart wird vorbereitet …" />;
  }

  if (status?.completed || submitted) {
    if (jobLoading && !job) {
      return <LoadingScreen text="Deine Plan-Erstellung wird geladen …" />;
    }
    return <PlanCreationStatus job={job} onNutrition={() => navigate({ to: "/nutrition" })} onDashboard={() => navigate({ to: "/dashboard" })} />;
  }

  if (!started) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl py-8 text-center sm:py-14">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Willkommen bei Smart</div>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Wir bauen deinen ersten Plan gemeinsam.</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
            Du richtest BodyFuel jetzt direkt ein. Wir fragen nur die Daten ab, die Smart für deinen Alltag, dein Training und deinen Ernährungsplan wirklich braucht.
          </p>
          <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
            <MiniFeature icon={<Target className="h-4 w-4" />} title="Ziel festlegen" text="Kalorien und Richtung" />
            <MiniFeature icon={<Utensils className="h-4 w-4" />} title="Ernährung anpassen" text="Vorlieben und Alltag" />
            <MiniFeature icon={<Sparkles className="h-4 w-4" />} title="Plan erstellen" text="Danach direkt ansehen" />
          </div>
          <Button className="mt-8 bg-gradient-gold text-primary-foreground" size="lg" onClick={() => setStarted(true)}>
            Smart einrichten <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  const meta = STEP_META[step];
  const Icon = meta.icon;
  const isLast = step === STEP_META.length - 1;
  const valid = isStepValid(step, form);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl py-4 sm:py-8">
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Smart Start · Schritt {step + 1} von {STEP_META.length}</div>
              <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{meta.title}</h1>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{meta.text}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-1.5">
            {STEP_META.map((_, index) => (
              <div key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-gold" : "bg-border"}`} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          {step === 0 && <PersonalStep form={form} update={update} />}
          {step === 1 && <GoalStep form={form} update={update} />}
          {step === 2 && <TrainingStep form={form} update={update} toggle={toggle} />}
          {step === 3 && <NutritionRoutineStep form={form} update={update} />}
          {step === 4 && <FoodStep form={form} update={update} toggle={toggle} />}
          {step === 5 && <SafetyStep form={form} update={update} toggle={toggle} />}
        </div>

        {mutation.isError && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={step === 0 || mutation.isPending} onClick={() => setStep((current) => current - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          {isLast ? (
            <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()} className="bg-gradient-gold text-primary-foreground">
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Daten werden gespeichert …
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Ernährungsplan erstellen
                </>
              )}
            </Button>
          ) : (
            <Button disabled={!valid} onClick={() => setStep((current) => current + 1)} className="bg-gradient-gold text-primary-foreground">
              Weiter <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function PersonalStep({ form, update }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Größe (cm)"><Input type="number" value={form.height_cm} onChange={(event) => update("height_cm", event.target.value)} /></Field>
      <Field label="Geschlecht"><Options options={[{ v: "male", l: "Männlich" }, { v: "female", l: "Weiblich" }, { v: "other", l: "Divers" }]} value={form.gender} onChange={(value) => update("gender", value as Form["gender"])} /></Field>
      <Field label="Geburtsdatum"><Input type="date" value={form.birthdate} onChange={(event) => update("birthdate", event.target.value)} /></Field>
      <Field label="Aktuelles Gewicht (kg)"><Input type="number" step="0.1" value={form.weight_kg} onChange={(event) => update("weight_kg", event.target.value)} /></Field>
      <Field label="Zielgewicht (kg)"><Input type="number" step="0.1" value={form.goal_weight_kg} onChange={(event) => update("goal_weight_kg", event.target.value)} /></Field>
    </div>
  );
}

function GoalStep({ form, update }: StepProps) {
  return (
    <div className="space-y-4">
      <Options options={GOALS.map((item) => ({ v: item.v, l: item.l }))} value={form.training_goal} onChange={(value) => update("training_goal", value as Form["training_goal"])} block />
      <Hint>Dein Ziel steuert nicht nur das Training. Es beeinflusst auch Kalorienziel, Makroverteilung und die Auswahl der Mahlzeiten.</Hint>
    </div>
  );
}

function TrainingStep({ form, update, toggle }: StepProps & { toggle: ToggleFn }) {
  return (
    <div className="space-y-5">
      <Field label="Trainingserfahrung"><Options options={EXPERIENCE.map((item) => ({ v: item.v, l: item.l }))} value={form.training_experience} onChange={(value) => update("training_experience", value as Form["training_experience"])} block /></Field>
      <Field label="Trainingsort"><Options options={LOCATIONS.map((item) => ({ v: item.v, l: item.l }))} value={form.training_location} onChange={(value) => update("training_location", value as Form["training_location"])} block /></Field>
      <Field label="Verfügbare Geräte"><Options options={EQUIPMENT.map((item) => ({ v: item.v, l: item.l }))} value={form.training_equipment} onChange={(value) => update("training_equipment", value as Form["training_equipment"])} block /></Field>
      <Field label="Trainingstage">
        <div className="flex flex-wrap gap-2">{WEEKDAYS.map((day) => <Chip key={day.v} active={form.training_weekdays.includes(day.v)} onClick={() => toggle("training_weekdays", day.v)}>{day.l}</Chip>)}</div>
      </Field>
      <Field label="Zeit pro Training"><Options options={DURATIONS.map((duration) => ({ v: String(duration), l: `${duration} Min.` }))} value={String(form.training_duration_min ?? "")} onChange={(value) => update("training_duration_min", Number(value))} /></Field>
    </div>
  );
}

function NutritionRoutineStep({ form, update }: StepProps) {
  const shoppingIndex = SHOPPING.findIndex((option) => JSON.stringify(option.days) === JSON.stringify(form.shopping_days));
  return (
    <div className="space-y-5">
      <Field label="Wie möchtest du essen?">
        <Options options={EATING_STYLES.map((item) => ({ v: item.v, l: item.l }))} value={form.eating_style} onChange={(value) => update("eating_style", value as Form["eating_style"])} block />
      </Field>
      {form.eating_style === "meal_prep" && (
        <Field label="Für wie viele Tage vorkochen?"><Options options={PREP_DAYS.map((days) => ({ v: String(days), l: `${days} Tage` }))} value={String(form.meal_prep_days ?? "")} onChange={(value) => update("meal_prep_days", Number(value))} /></Field>
      )}
      <Field label="Wie oft kaufst du ein?">
        <Options
          options={SHOPPING.map((item, index) => ({ v: String(index), l: item.l }))}
          value={shoppingIndex >= 0 ? String(shoppingIndex) : ""}
          onChange={(value) => {
            const option = SHOPPING[Number(value)];
            update("shopping_days", [...option.days]);
            update("shopping_lead_days", option.lead);
          }}
          block
        />
      </Field>
      <Field label="Wochenbudget"><Options options={BUDGETS.map((item) => ({ v: item.v, l: item.l }))} value={form.budget_band} onChange={(value) => update("budget_band", value as Form["budget_band"])} block /></Field>
      <Field label="Optional: genauer Betrag (€)"><Input type="number" value={form.weekly_budget_eur} onChange={(event) => update("weekly_budget_eur", event.target.value)} placeholder="z. B. 65" /></Field>
      <Field label="Wie viel Abwechslung möchtest du?"><Options options={VARIETY.map((item) => ({ v: item.v, l: item.l }))} value={form.variety_level} onChange={(value) => update("variety_level", value as Form["variety_level"])} /></Field>
    </div>
  );
}

function FoodStep({ form, update, toggle }: StepProps & { toggle: ToggleFn }) {
  return (
    <div className="space-y-5">
      <Field label="Ernährungsform"><Options options={DIET_STYLES.map((item) => ({ v: item.v, l: item.l }))} value={form.diet_style} onChange={(value) => update("diet_style", value as Form["diet_style"])} block /></Field>
      <Field label="Was isst du gerne?">
        <div className="flex flex-wrap gap-2">{FAVORITES.map((food) => <Chip key={food} active={form.favorite_foods.includes(food)} onClick={() => toggle("favorite_foods", food)}>{food}</Chip>)}</div>
        <Input className="mt-3" value={form.extra_favorites} onChange={(event) => update("extra_favorites", event.target.value)} placeholder="Weitere Lieblingslebensmittel" />
      </Field>
      <Field label="Was möchtest du nicht im Plan sehen?"><Textarea rows={2} value={form.extra_nogos} onChange={(event) => update("extra_nogos", event.target.value)} placeholder="z. B. Pilze, Oliven, Schweinefleisch …" /></Field>
      <Field label="Details / Ausnahmen"><Textarea rows={2} value={form.diet_notes} onChange={(event) => update("diet_notes", event.target.value)} placeholder="Optional: weitere Regeln für deine Ernährung" /></Field>
    </div>
  );
}

function SafetyStep({ form, update, toggle }: StepProps & { toggle: ToggleFn }) {
  return (
    <div className="space-y-5">
      <Field label="Allergien">
        <div className="flex flex-wrap gap-2">{ALLERGIES.map((item) => <Chip key={item} active={form.allergies.includes(item)} onClick={() => toggle("allergies", item)}>{item}</Chip>)}</div>
        <Input className="mt-3" value={form.extra_allergies} onChange={(event) => update("extra_allergies", event.target.value)} placeholder="Weitere Allergien" />
      </Field>
      <Field label="Unverträglichkeiten"><div className="flex flex-wrap gap-2">{INTOLERANCES.map((item) => <Chip key={item} active={form.intolerances.includes(item)} onClick={() => toggle("intolerances", item)}>{item}</Chip>)}</div></Field>
      <div className="rounded-xl border border-gold/25 bg-gold/10 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <div className="font-semibold">Als Nächstes baut Smart deinen Ernährungsplan.</div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Du bleibst dabei im geführten Ablauf. Sobald Ernährung fertig ist, öffnen wir deinen Plan direkt – das Training darf im Hintergrund weiterlaufen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCreationStatus({ job, onNutrition, onDashboard }: { job: any; onNutrition: () => void; onDashboard: () => void }) {
  const nutritionReady = !!job?.nutrition_plan_id;
  const trainingReady = !!job?.training_plan_id;
  const failed = job?.status === "failed" && !nutritionReady;

  if (nutritionReady) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl py-10 text-center sm:py-16">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-8 w-8" /></div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Smart Nutrition ist bereit</div>
          <h1 className="mt-2 font-display text-3xl font-bold">Dein Ernährungsplan ist fertig.</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Jetzt geht es nicht zurück ins Dashboard, sondern direkt in deinen echten Plan. Dort siehst du Mahlzeiten, Tagesstruktur und deine Ziele im Zusammenhang.</p>
          <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
            <MiniFeature icon={<Utensils className="h-4 w-4" />} title="Mahlzeiten" text="Dein kompletter Tagesplan" />
            <MiniFeature icon={<Target className="h-4 w-4" />} title="Makros" text="Kalorien und Verteilung" />
            <MiniFeature icon={<ShoppingBasket className="h-4 w-4" />} title="Einkauf" text="Automatisch aus dem Plan" />
          </div>
          {!trainingReady && <div className="mt-5 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Dein Trainingsplan darf parallel im Hintergrund weiter entstehen.</div>}
          <Button className="mt-7 bg-gradient-gold text-primary-foreground" size="lg" onClick={onNutrition}>Meinen Ernährungsplan ansehen <ChevronRight className="ml-2 h-4 w-4" /></Button>
          <div><Button variant="ghost" className="mt-2" onClick={onDashboard}>Später zum Dashboard</Button></div>
        </div>
      </Shell>
    );
  }

  if (failed) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl py-12 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">Plan-Erstellung unterbrochen</div>
          <h1 className="mt-2 font-display text-3xl font-bold">Deine Daten sind gespeichert.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Beim Erstellen des Plans ist ein Fehler aufgetreten. Deine Angaben gehen nicht verloren.</p>
          {job?.error && <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left text-sm text-destructive">{job.error}</div>}
          <Button className="mt-6" onClick={onDashboard}>Zum Dashboard</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-xl py-10 sm:py-16">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold"><Loader2 className="h-8 w-8 animate-spin" /></div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Smart arbeitet</div>
          <h1 className="mt-2 font-display text-3xl font-bold">Wir bauen jetzt deinen Ernährungsplan.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Du musst nichts neu laden oder zusammensuchen. Sobald der Ernährungsplan fertig ist, geht es hier direkt weiter.</p>
        </div>
        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
          <StatusRow done title="Deine Angaben sind gespeichert" text="Ziel, Alltag, Training und Ernährung" />
          <StatusRow done={nutritionReady} active={!nutritionReady} title="Smart Nutrition wird erstellt" text="Mahlzeiten, Kalorien, Makros und Struktur" />
          <StatusRow done={trainingReady} active={!!job && job?.step !== "nutrition" && !trainingReady} title="Training wird vorbereitet" text="Läuft anschließend im Hintergrund weiter" />
        </div>
      </div>
    </Shell>
  );
}

function StatusRow({ done, active, title, text }: { done?: boolean; active?: boolean; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-500/15 text-emerald-500" : active ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </div>
      <div><div className="text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs text-muted-foreground">{text}</div></div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4"><Logo /><div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Smart Start</div></div>
        {children}
      </div>
    </main>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Sparkles className="h-5 w-5 animate-pulse text-gold" /> {text}</div></div>;
}

function MiniFeature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="text-gold">{icon}</div><div className="mt-2 text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs text-muted-foreground">{text}</div></div>;
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-gold/20 bg-gold/10 p-4 text-sm leading-5 text-muted-foreground">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

type UpdateFn = <K extends keyof Form>(key: K, value: Form[K]) => void;
type ToggleFn = (key: "training_weekdays" | "favorite_foods" | "allergies" | "intolerances", value: string) => void;
type StepProps = { form: Form; update: UpdateFn };

function Options({ options, value, onChange, block }: { options: { v: string; l: string }[]; value: string; onChange: (value: string) => void; block?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2 ${block ? "sm:grid sm:grid-cols-2" : ""}`}>
      {options.map((option) => (
        <button key={option.v} type="button" onClick={() => onChange(option.v)} className={`rounded-xl border px-4 py-2 text-sm transition ${value === option.v ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/40"}`}>
          {value === option.v && <Check className="mr-1 inline h-3.5 w-3.5" />} {option.l}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/40"}`}>{children}</button>;
}

function isStepValid(step: number, form: Form) {
  if (step === 0) return !!(form.height_cm && form.gender && form.birthdate && form.weight_kg && form.goal_weight_kg);
  if (step === 1) return !!form.training_goal;
  if (step === 2) return !!(form.training_experience && form.training_location && form.training_equipment && form.training_weekdays.length && form.training_duration_min);
  if (step === 3) return !!(form.eating_style && (form.eating_style !== "meal_prep" || form.meal_prep_days) && form.shopping_days.length && form.budget_band && form.variety_level);
  if (step === 4) return !!form.diet_style;
  return true;
}

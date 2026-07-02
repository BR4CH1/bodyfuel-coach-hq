import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  completeSmartOnboarding,
  getOnboardingStatus,
} from "@/lib/smart-onboarding.functions";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/bodyfuel/Logo";

export const Route = createFileRoute("/onboarding/smart")({
  head: () => ({
    meta: [
      { title: "BodyFuel Smart Onboarding" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SmartOnboardingPage,
});

const GOALS = [
  { v: "fat_loss", l: "Abnehmen" },
  { v: "lean_bulk", l: "Muskelaufbau" },
  { v: "performance", l: "Performance" },
  { v: "recomp", l: "Recomposition" },
] as const;
const EXP = [
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
  { v: "monday", l: "Mo" }, { v: "tuesday", l: "Di" }, { v: "wednesday", l: "Mi" },
  { v: "thursday", l: "Do" }, { v: "friday", l: "Fr" }, { v: "saturday", l: "Sa" },
  { v: "sunday", l: "So" },
] as const;
const DURATIONS = [30, 45, 60, 90];
const EAT_STYLES = [
  { v: "meal_prep", l: "Meal Prep" },
  { v: "fresh", l: "Frisch kochen" },
  { v: "mixed", l: "Gemischt" },
] as const;
const PREP_DAYS = [
  { v: 2, l: "2 Tage" }, { v: 3, l: "3 Tage" }, { v: 4, l: "4 Tage" },
  { v: 5, l: "5 Tage" }, { v: 7, l: "Ganze Woche" },
];
const SHOP_FREQ = [
  { days: ["monday","wednesday","friday","sunday"], lead: 0, l: "Täglich" },
  { days: ["monday","wednesday","friday"], lead: 2, l: "Alle 2 Tage" },
  { days: ["monday","thursday"], lead: 3, l: "Alle 3 Tage" },
  { days: ["saturday"], lead: 6, l: "Wöchentlich" },
];
const BUDGETS = [
  { v: "<50", l: "Sparsam" },
  { v: "50_75", l: "Normal" },
  { v: ">100", l: "Premium" },
] as const;
const VARIETY = [
  { v: "low", l: "Wenig" },
  { v: "medium", l: "Mittel" },
  { v: "high", l: "Hoch" },
] as const;
const FAVORITES = [
  "Hähnchen","Rind","Pute","Eier","Skyr","Fisch","Reis","Nudeln","Kartoffeln",
  "Wraps","Haferflocken","Obst","Gemüse","Käse","Nüsse","Proteinpulver",
];
const ALLERGIES = ["Laktose","Gluten","Nüsse","Soja","Ei","Fisch","Meeresfrüchte"];
const INTOLERANCES = ["Fructose","Histamin","Sorbit","FODMAP"];

type Form = {
  height_cm: string; gender: "" | "male" | "female" | "other";
  birthdate: string; weight_kg: string; goal_weight_kg: string;
  training_goal: "" | "fat_loss" | "lean_bulk" | "performance" | "recomp";
  training_experience: "" | "beginner" | "intermediate" | "advanced";
  training_location: "" | "gym" | "home_gym" | "home";
  training_equipment: "" | "machines" | "free_weights" | "both";
  training_weekdays: string[];
  training_duration_min: number | null;
  eating_style: "" | "meal_prep" | "fresh" | "mixed";
  meal_prep_days: number | null;
  shopping_days: string[]; shopping_lead_days: number;
  budget_band: "" | "<50" | "50_75" | ">100";
  weekly_budget_eur: string;
  variety_level: "" | "low" | "medium" | "high";
  favorite_foods: string[]; nogo_foods: string[];
  allergies: string[]; intolerances: string[];
  extra_favorites: string; extra_nogos: string; extra_allergies: string;
  diet_style: "" | "omnivore" | "flexitarian" | "pescetarian" | "vegetarian" | "vegan" | "other";
  diet_notes: string;
};

const EMPTY: Form = {
  height_cm: "", gender: "", birthdate: "", weight_kg: "", goal_weight_kg: "",
  training_goal: "", training_experience: "", training_location: "",
  training_equipment: "", training_weekdays: [], training_duration_min: null,
  eating_style: "", meal_prep_days: null, shopping_days: [], shopping_lead_days: 2,
  budget_band: "", weekly_budget_eur: "", variety_level: "",
  favorite_foods: [], nogo_foods: [], allergies: [], intolerances: [],
  extra_favorites: "", extra_nogos: "", extra_allergies: "",
  diet_style: "", diet_notes: "",
};

function SmartOnboardingPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading } = useSession();
  const statusFn = useServerFn(getOnboardingStatus);
  const completeFn = useServerFn(completeSmartOnboarding);

  useEffect(() => {
    if (!loading && !supabaseUser) navigate({ to: "/auth" });
  }, [loading, supabaseUser, navigate]);

  const { data: status } = useQuery({
    queryKey: ["smart-onboarding-status"],
    queryFn: () => statusFn(),
    enabled: !!supabaseUser,
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(0);
  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: keyof Form, v: string) => {
    const arr = (form[k] as string[]) ?? [];
    upd(k, (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]) as any);
  };

  // Prefill height/gender/birthdate from profile if present
  useEffect(() => {
    if (!supabaseUser) return;
    supabase.from("profiles")
      .select("height_cm,gender,birthdate,goal_weight_kg,training_goal")
      .eq("id", supabaseUser.id).maybeSingle().then(({ data }) => {
        if (!data) return;
        setForm((f) => ({
          ...f,
          height_cm: data.height_cm?.toString() ?? f.height_cm,
          gender: (data.gender as any) ?? f.gender,
          birthdate: data.birthdate ?? f.birthdate,
          goal_weight_kg: data.goal_weight_kg?.toString() ?? f.goal_weight_kg,
          training_goal: (data.training_goal as any) ?? f.training_goal,
        }));
      });
  }, [supabaseUser]);

  const mut = useMutation({
    mutationFn: async () => {
      // 1) Pflichtdaten speichern + Training-Plan automatisch erstellen & aktivieren
      await completeFn({
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
          nogo_foods: form.nogo_foods,
          allergies: form.allergies,
          intolerances: form.intolerances,
          extra_favorites: form.extra_favorites || null,
          extra_nogos: form.extra_nogos || null,
          extra_allergies: form.extra_allergies || null,
          diet_style: form.diet_style || null,
          diet_notes: form.diet_notes || null,
        },
      });
      // Pläne werden im Hintergrund (Queue + Cron) generiert, damit das
      // Onboarding sofort fertig ist statt 2-4 Minuten zu blocken.
    },
    onSuccess: () => {
      toast.success("Autopilot gestartet! Deine Pläne entstehen im Hintergrund.");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (status?.completed) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-display text-2xl font-bold">Schon erledigt ✓</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dein Smart-Onboarding ist abgeschlossen.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
          Zum Dashboard
        </Button>
      </div>
    );
  }

  const steps: Array<{ title: string; valid: boolean; body: React.ReactNode }> = [
    {
      title: "Persönliche Daten",
      valid: !!(form.height_cm && form.gender && form.birthdate && form.weight_kg && form.goal_weight_kg),
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Größe (cm)"><Input type="number" value={form.height_cm} onChange={(e) => upd("height_cm", e.target.value)} /></Field>
          <Field label="Geschlecht">
            <SegBtns options={[{v:"male",l:"Männlich"},{v:"female",l:"Weiblich"},{v:"other",l:"Divers"}]} value={form.gender} onChange={(v) => upd("gender", v as any)} />
          </Field>
          <Field label="Geburtsdatum"><Input type="date" value={form.birthdate} onChange={(e) => upd("birthdate", e.target.value)} /></Field>
          <Field label="Aktuelles Gewicht (kg)"><Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => upd("weight_kg", e.target.value)} /></Field>
          <Field label="Zielgewicht (kg)"><Input type="number" step="0.1" value={form.goal_weight_kg} onChange={(e) => upd("goal_weight_kg", e.target.value)} /></Field>
        </div>
      ),
    },
    {
      title: "Dein Ziel",
      valid: !!form.training_goal,
      body: <SegBtns options={GOALS.map((g)=>({v:g.v,l:g.l}))} value={form.training_goal} onChange={(v) => upd("training_goal", v as any)} block />,
    },
    {
      title: "Trainingserfahrung",
      valid: !!form.training_experience,
      body: <SegBtns options={EXP.map((g)=>({v:g.v,l:g.l}))} value={form.training_experience} onChange={(v) => upd("training_experience", v as any)} block />,
    },
    {
      title: "Trainingsort",
      valid: !!form.training_location,
      body: <SegBtns options={LOCATIONS.map((g)=>({v:g.v,l:g.l}))} value={form.training_location} onChange={(v) => upd("training_location", v as any)} block />,
    },
    {
      title: "Verfügbare Geräte",
      valid: !!form.training_equipment,
      body: <SegBtns options={EQUIPMENT.map((g)=>({v:g.v,l:g.l}))} value={form.training_equipment} onChange={(v) => upd("training_equipment", v as any)} block />,
    },
    {
      title: "Trainingstage",
      valid: form.training_weekdays.length > 0,
      body: <div className="flex flex-wrap gap-2">{WEEKDAYS.map((d) => (
        <Chip key={d.v} active={form.training_weekdays.includes(d.v)} onClick={() => toggle("training_weekdays", d.v)}>{d.l}</Chip>
      ))}</div>,
    },
    {
      title: "Trainingsdauer",
      valid: form.training_duration_min != null,
      body: <SegBtns options={DURATIONS.map((d)=>({v:String(d),l:`${d} Minuten`}))} value={String(form.training_duration_min ?? "")} onChange={(v) => upd("training_duration_min", Number(v))} block />,
    },
    {
      title: "Wie möchtest du essen?",
      valid: !!form.eating_style && (form.eating_style !== "meal_prep" || form.meal_prep_days != null),
      body: (
        <div className="space-y-4">
          <SegBtns options={EAT_STYLES.map((g)=>({v:g.v,l:g.l}))} value={form.eating_style} onChange={(v) => upd("eating_style", v as any)} block />
          {form.eating_style === "meal_prep" && (
            <div>
              <Label className="mb-2 block">Für wie viele Tage vorkochen?</Label>
              <SegBtns options={PREP_DAYS.map((d)=>({v:String(d.v),l:d.l}))} value={String(form.meal_prep_days ?? "")} onChange={(v) => upd("meal_prep_days", Number(v))} block />
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Wie oft kaufst du ein?",
      valid: form.shopping_days.length > 0,
      body: <SegBtns
        options={SHOP_FREQ.map((s,i)=>({v:String(i),l:s.l}))}
        value={SHOP_FREQ.findIndex((s)=>JSON.stringify(s.days)===JSON.stringify(form.shopping_days)).toString()}
        onChange={(v) => {
          const s = SHOP_FREQ[Number(v)];
          upd("shopping_days", s.days);
          upd("shopping_lead_days", s.lead);
        }} block />,
    },
    {
      title: "Welches Budget?",
      valid: !!form.budget_band,
      body: (
        <div className="space-y-4">
          <SegBtns options={BUDGETS.map((g)=>({v:g.v,l:g.l}))} value={form.budget_band} onChange={(v) => upd("budget_band", v as any)} block />
          <Field label="Optional: festes Wochenbudget (€)">
            <Input type="number" value={form.weekly_budget_eur} onChange={(e) => upd("weekly_budget_eur", e.target.value)} />
          </Field>
        </div>
      ),
    },
    {
      title: "Wie viel Abwechslung?",
      valid: !!form.variety_level,
      body: <SegBtns options={VARIETY.map((g)=>({v:g.v,l:g.l}))} value={form.variety_level} onChange={(v) => upd("variety_level", v as any)} block />,
    },
    {
      title: "Ernährungsform",
      valid: !!form.diet_style,
      body: (
        <div className="space-y-4">
          <SegBtns
            options={[
              { v: "omnivore", l: "Alles (Omnivor)" },
              { v: "flexitarian", l: "Flexitarisch" },
              { v: "pescetarian", l: "Pescetarisch" },
              { v: "vegetarian", l: "Vegetarisch" },
              { v: "vegan", l: "Vegan" },
              { v: "other", l: "Andere" },
            ]}
            value={form.diet_style}
            onChange={(v) => upd("diet_style", v as any)}
            block
          />
          <Field label="Details / Ausnahmen (optional)">
            <Textarea
              rows={3}
              value={form.diet_notes}
              onChange={(e) => upd("diet_notes", e.target.value)}
              placeholder="z.B. kein Schweinefleisch, nur Bio-Fleisch, gelegentlich Fisch, keine tierischen Produkte außer Honig ..."
            />
          </Field>
        </div>
      ),
    },
    {
      title: "Lebensmittel",
      valid: true,
      body: (
        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Mag ich</Label>
            <div className="flex flex-wrap gap-2">{FAVORITES.map((f) => (
              <Chip key={f} active={form.favorite_foods.includes(f)} onClick={() => toggle("favorite_foods", f)}>{f}</Chip>
            ))}</div>
            <Input className="mt-2" placeholder="Weitere Lieblingslebensmittel" value={form.extra_favorites} onChange={(e) => upd("extra_favorites", e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Mag ich nicht</Label>
            <Textarea rows={2} value={form.extra_nogos} onChange={(e) => upd("extra_nogos", e.target.value)} placeholder="z.B. Pilze, Oliven, ..." />
          </div>
          <div>
            <Label className="mb-2 block">Allergien</Label>
            <div className="flex flex-wrap gap-2">{ALLERGIES.map((f) => (
              <Chip key={f} active={form.allergies.includes(f)} onClick={() => toggle("allergies", f)}>{f}</Chip>
            ))}</div>
            <Input className="mt-2" placeholder="Weitere Allergien" value={form.extra_allergies} onChange={(e) => upd("extra_allergies", e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Unverträglichkeiten</Label>
            <div className="flex flex-wrap gap-2">{INTOLERANCES.map((f) => (
              <Chip key={f} active={form.intolerances.includes(f)} onClick={() => toggle("intolerances", f)}>{f}</Chip>
            ))}</div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">BodyFuel Smart · Onboarding</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{current.title}</h1>
          <div className="mt-3 flex items-center gap-1">
            {steps.map((_, i) => (
              <div key={i} className={"h-1 flex-1 rounded-full " + (i <= step ? "bg-gold" : "bg-border")} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Schritt {step + 1} von {steps.length}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">{current.body}</div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={step === 0 || mut.isPending} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          {isLast ? (
            <Button disabled={!current.valid || mut.isPending} onClick={() => mut.mutate()} className="bg-gradient-gold text-primary-foreground">
              {mut.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Autopilot startet …</> : <><Sparkles className="mr-1 h-4 w-4" /> Autopilot starten</>}
            </Button>
          ) : (
            <Button disabled={!current.valid} onClick={() => setStep((s) => s + 1)} className="bg-gradient-gold text-primary-foreground">
              Weiter <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function SegBtns({ options, value, onChange, block }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; block?: boolean;
}) {
  return (
    <div className={"flex flex-wrap gap-2" + (block ? " " : "")}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "rounded-full border px-4 py-2 text-sm transition " +
            (value === o.v ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/40")
          }
        >
          {value === o.v && <Check className="mr-1 inline h-3.5 w-3.5" />}
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={
      "rounded-full border px-3 py-1.5 text-sm transition " +
      (active ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/40")
    }>{children}</button>
  );
}

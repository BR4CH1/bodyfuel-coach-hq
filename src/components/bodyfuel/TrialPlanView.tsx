import { useEffect, useState } from "react";
import { Utensils, Dumbbell, Sparkles, Lock, Check, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { TRIAL_NUTRITION, TRIAL_TRAINING, type TrialMeal } from "@/lib/bodyfuel/trialPlans";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { getDayType } from "@/lib/nutrition.functions";
import { ensureTrialTrainingPlan } from "@/lib/trial.functions";

function mapMealCategory(name: string): "breakfast" | "lunch" | "dinner" | "snack" {
  const n = name.toLowerCase();
  if (n.includes("frühstück")) return "breakfast";
  if (n.includes("mittag")) return "lunch";
  if (n.includes("abend")) return "dinner";
  return "snack";
}

/** Liest Read-only-Starterpläne für den Trial – keine DB-Abhängigkeit. */
export function TrialNutritionPlan() {
  const { supabaseUser } = useSession();
  const getDayFn = useServerFn(getDayType);
  const ensureFn = useServerFn(ensureTrialTrainingPlan);
  const [dayId, setDayId] = useState<string>(TRIAL_NUTRITION[0].id);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const day = TRIAL_NUTRITION.find((d) => d.id === dayId)!;
  const [variantId, setVariantId] = useState<string>(day.variants[0].id);
  const variant = day.variants.find((v) => v.id === variantId) ?? day.variants[0];

  // Automatisch Trainings- vs. Restday wählen (anhand heutiger Trainings-Logs / Override)
  useEffect(() => {
    if (!supabaseUser) return;
    // Trial-Seeds (Trainingsplan + Nutrition-Targets) idempotent sicherstellen.
    ensureFn().catch(() => {});
    let cancelled = false;
    const date = new Date().toISOString().slice(0, 10);
    getDayFn({ data: { user_id: supabaseUser.id, date } })
      .then((res) => {
        if (cancelled || !res?.kind) return;
        const targetId = res.kind === "training" ? "training" : "rest";
        const target = TRIAL_NUTRITION.find((d) => d.id === targetId);
        if (target) {
          setDayId(target.id);
          setVariantId(target.variants[0].id);
          setAutoNote(
            res.source === "manual"
              ? `Heute manuell als ${res.kind === "training" ? "Trainingstag" : "Restday"} markiert.`
              : `Automatisch erkannt: ${res.kind === "training" ? "Trainingstag (Sätze geloggt)" : "Restday (noch keine Sätze)"}.`,
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [supabaseUser, getDayFn]);

  return (
    <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-card to-gold/5 p-5 sm:p-6">
      <Header
        icon={<Utensils className="h-4 w-4" />}
        eyebrow="Trial-Ernährungsplan"
        title="Starterplan"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select
          label="Tag"
          value={dayId}
          onChange={(v) => {
            setDayId(v);
            const d = TRIAL_NUTRITION.find((x) => x.id === v)!;
            setVariantId(d.variants[0].id);
          }}
          options={TRIAL_NUTRITION.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select
          label="Variante"
          value={variantId}
          onChange={setVariantId}
          options={day.variants.map((v) => ({ value: v.id, label: v.label }))}
        />
      </div>

      {autoNote && (
        <p className="mt-3 text-[11px] text-muted-foreground">{autoNote}</p>
      )}

      <div className="mt-4 space-y-3">
        {variant.meals.map((m, i) => (
          <TrialMealCard key={`${dayId}-${variantId}-${i}`} meal={m} />
        ))}
      </div>


      <UpgradeHint
        text="Dein individueller Plan – abgestimmt auf Ziel, Vorlieben & Trainingstage – wird mit deiner Mitgliedschaft freigeschaltet."
      />
    </div>
  );
}

export function TrialTrainingPlan() {
  const [dayId, setDayId] = useState<string>(TRIAL_TRAINING[0].id);
  const day = TRIAL_TRAINING.find((d) => d.id === dayId)!;

  return (
    <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-card to-gold/5 p-5 sm:p-6">
      <Header
        icon={<Dumbbell className="h-4 w-4" />}
        eyebrow="Trial-Trainingsplan"
        title="3er-Split (A · B · C)"
      />

      <div className="mt-4">
        <Select
          label="Tag"
          value={dayId}
          onChange={setDayId}
          options={TRIAL_TRAINING.map((d) => ({ value: d.id, label: `${d.name} — ${d.focus}` }))}
        />
      </div>

      <div className="mt-4 space-y-2">
        {day.exercises.map((e, i) => (
          <div key={i} className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-semibold">{e.name}</div>
              <div className="text-xs text-muted-foreground">
                {e.sets}× {e.reps}
              </div>
            </div>
            {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
          </div>
        ))}
      </div>

      <UpgradeHint
        text="Dein individueller Trainingsplan – passend zu Equipment, Erfahrung & Zielen – wird mit deiner Mitgliedschaft freigeschaltet."
      />
    </div>
  );
}

function Header({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-gold">{icon}</div>
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</div>
        <div className="font-display text-base font-bold">{title}</div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
        <Sparkles className="h-3 w-3" /> Trial
      </span>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function UpgradeHint({ text }: { text: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-gold/40 bg-background/40 p-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <div className="flex-1 text-xs text-muted-foreground">{text}</div>
      <Link
        to="/profile"
        className="shrink-0 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-bold text-primary-foreground"
      >
        Aktivieren
      </Link>
    </div>
  );
}

function TrialMealCard({ meal }: { meal: TrialMeal }) {
  const { supabaseUser } = useSession();
  const [busy, setBusy] = useState(false);
  const [tracked, setTracked] = useState(false);

  const track = async () => {
    if (!supabaseUser || busy || tracked) return;
    setBusy(true);
    const { error } = await supabase.from("food_entries").insert({
      user_id: supabaseUser.id,
      entry_date: new Date().toISOString().slice(0, 10),
      meal: mapMealCategory(meal.name),
      name: `${meal.name} — ${meal.description}`.slice(0, 200),
      serving_g: 100,
      kcal: meal.kcal,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      source: "trial-plan",
    });
    setBusy(false);
    if (error) {
      toast.error("Konnte Mahlzeit nicht tracken: " + error.message);
      return;
    }
    setTracked(true);
    toast.success(`${meal.name} getrackt`);
  };

  return (
    <button
      type="button"
      onClick={track}
      disabled={busy || tracked || !supabaseUser}
      className={
        "group block w-full rounded-2xl border p-4 text-left transition " +
        (tracked
          ? "border-gold/60 bg-gold/10"
          : "border-border bg-background/40 hover:border-gold/50 hover:bg-accent/40")
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-gold">{meal.name}</div>
        <div className="text-[11px] text-muted-foreground">{meal.kcal} kcal</div>
      </div>
      <p className="mt-1 text-sm">{meal.description}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span>P {meal.protein_g}g</span>
          <span>· KH {meal.carbs_g}g</span>
          <span>· F {meal.fat_g}g</span>
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
            (tracked
              ? "bg-gold/20 text-gold"
              : "bg-secondary text-muted-foreground group-hover:bg-gold/15 group-hover:text-gold")
          }
        >
          {tracked ? <><Check className="h-3 w-3" /> Getrackt</> : <><Plus className="h-3 w-3" /> Tracken</>}
        </span>
      </div>
    </button>
  );
}

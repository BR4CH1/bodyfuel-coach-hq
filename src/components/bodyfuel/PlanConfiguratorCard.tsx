import { Plus, Sliders, Users, X } from "lucide-react";
import { useState } from "react";
import {
  DIET_RULE_LABELS,
  EXCLUSION_GROUP_LABELS,
  summarizeActiveRules,
  type DietRule,
  type ExclusionGroup,
  type LifestyleFlag,
  type PlanConstraintConfig,
  type PlanGoal,
} from "@/lib/nutrition-plan-constraints";

export type PlanConfig = PlanConstraintConfig;

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  goal: "halten",
  dietRules: [],
  exclusionGroups: [],
  customExclusions: [],
  preferences: [],
  lifestyle: [],
  mealsPerDay: 3,
  planDays: 7,
  partner: false,
};

const GOALS: { id: PlanGoal; label: string }[] = [
  { id: "abnehmen", label: "Abnehmen" },
  { id: "muskelaufbau", label: "Muskelaufbau" },
  { id: "halten", label: "Gewicht halten" },
  { id: "performance", label: "Performance" },
  { id: "individuell", label: "Individuell" },
];

const LIFESTYLE: { id: LifestyleFlag; label: string }[] = [
  { id: "meal_prep", label: "Meal Prep" },
  { id: "schnell", label: "Schnell & einfach" },
  { id: "wenig_zutaten", label: "Wenig Zutaten" },
  { id: "budget", label: "Budgetfreundlich" },
  { id: "unterwegs", label: "Unterwegs / keine Küche" },
];

const PERIODS = [7, 14, 21, 28];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
  tone = "gold",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "gold" | "danger";
}) {
  const activeClass =
    tone === "danger"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-gold/50 bg-gold/10 text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
        active ? activeClass : "border-border bg-background/50 text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Checkbox-/Card-Konfigurator für den Smart Nutrition Plan Builder. */
export function PlanConfiguratorCard({
  value,
  onChange,
  partnerAvailable,
  partnerName,
  customPeriod,
}: {
  value: PlanConfig;
  onChange: (next: PlanConfig) => void;
  partnerAvailable?: boolean;
  partnerName?: string;
  /** Wird angezeigt, wenn der Zeitraum über die Datumsfelder gesetzt wurde. */
  customPeriod?: boolean;
}) {
  const [exclusionInput, setExclusionInput] = useState("");
  const [preferenceInput, setPreferenceInput] = useState("");
  const set = (patch: Partial<PlanConfig>) => onChange({ ...value, ...patch });

  const addTo = (key: "customExclusions" | "preferences", raw: string) => {
    const entry = raw.trim();
    if (!entry) return;
    const current = value[key];
    if (current.some((v) => v.toLowerCase() === entry.toLowerCase())) return;
    set({ [key]: [...current, entry] } as Partial<PlanConfig>);
  };

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <Sliders className="h-4 w-4 text-gold" />
        <h3 className="font-display text-sm font-bold">Plan-Konfigurator</h3>
      </div>

      <Group title="1 · Plan-Ziel">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GOALS.map((goal) => (
            <Chip
              key={goal.id}
              active={value.goal === goal.id}
              onClick={() => set({ goal: goal.id })}
            >
              {goal.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group
        title="2 · Harte Regeln & No-Gos"
        hint="Absolute Ausschlüsse — diese Lebensmittel tauchen in keiner Zutat auf."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(DIET_RULE_LABELS) as DietRule[]).map((rule) => (
            <Chip
              key={rule}
              active={value.dietRules.includes(rule)}
              onClick={() => set({ dietRules: toggle(value.dietRules, rule) })}
            >
              {DIET_RULE_LABELS[rule]}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(EXCLUSION_GROUP_LABELS) as ExclusionGroup[]).map((group) => (
            <Chip
              key={group}
              tone="danger"
              active={value.exclusionGroups.includes(group)}
              onClick={() => set({ exclusionGroups: toggle(value.exclusionGroups, group) })}
            >
              ohne {EXCLUSION_GROUP_LABELS[group]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={exclusionInput}
            onChange={(e) => setExclusionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTo("customExclusions", exclusionInput);
                setExclusionInput("");
              }
            }}
            placeholder="Eigenes No-Go (z. B. Paprika)"
            className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              addTo("customExclusions", exclusionInput);
              setExclusionInput("");
            }}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </button>
        </div>
        {value.customExclusions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.customExclusions.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive"
              >
                {entry}
                <button
                  type="button"
                  aria-label={`${entry} entfernen`}
                  onClick={() =>
                    set({ customExclusions: value.customExclusions.filter((v) => v !== entry) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Group>

      <Group
        title="3 · Vorlieben (optional)"
        hint="Nur Bonusfaktor beim Ranking — der Plan funktioniert auch ohne Vorlieben."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={preferenceInput}
            onChange={(e) => setPreferenceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTo("preferences", preferenceInput);
                setPreferenceInput("");
              }
            }}
            placeholder="Lieblingsgericht oder -lebensmittel"
            className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              addTo("preferences", preferenceInput);
              setPreferenceInput("");
            }}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </button>
        </div>
        {value.preferences.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.preferences.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px]"
              >
                {entry}
                <button
                  type="button"
                  aria-label={`${entry} entfernen`}
                  onClick={() => set({ preferences: value.preferences.filter((v) => v !== entry) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Group>

      <Group title="4 · Alltag">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LIFESTYLE.map((flag) => (
            <Chip
              key={flag.id}
              active={value.lifestyle.includes(flag.id)}
              onClick={() => set({ lifestyle: toggle(value.lifestyle, flag.id) })}
            >
              {flag.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mahlzeiten pro Tag</span>
          {[3, 4, 5].map((count) => (
            <Chip
              key={count}
              active={value.mealsPerDay === count}
              onClick={() => set({ mealsPerDay: count })}
            >
              {count}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="5 · Zeitraum">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((days) => (
            <Chip
              key={days}
              active={!customPeriod && value.planDays === days}
              onClick={() => set({ planDays: days })}
            >
              {days} Tage
            </Chip>
          ))}
          <span className="text-[11px] text-muted-foreground">
            {customPeriod
              ? `Eigener Zeitraum aktiv (${value.planDays} Tage)`
              : "oder eigenen Zeitraum über die Datumsfelder wählen"}
          </span>
        </div>
      </Group>

      <Group title="6 · Personen">
        <div className="flex flex-wrap gap-2">
          <Chip active={!value.partner} onClick={() => set({ partner: false })}>
            Einzelperson
          </Chip>
          <Chip
            active={value.partner}
            onClick={() => partnerAvailable && set({ partner: true })}
          >
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {partnerAvailable ? `Partnerplan${partnerName ? ` · ${partnerName}` : ""}` : "Partnerplan (kein Partner verknüpft)"}
            </span>
          </Chip>
        </div>
      </Group>

      <div className="rounded-xl border border-dashed border-border bg-card/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Aktive Regeln
        </p>
        <p className="mt-1 break-words text-xs">{summarizeActiveRules(value).join(" · ")}</p>
      </div>
    </div>
  );
}

/**
 * DayPlanView — Mobile-first Tagesansicht des Ernährungsplans.
 *
 * Presentational only: bekommt fertige Mahlzeiten-Daten von außen (PlanContentView
 * oder BullsPlanContentView) und rendert Tageskopf, Fortschritt, gruppierte
 * Sections (MORGEN · MITTAG · RUND UMS TRAINING · ABEND), kompakte Snacks
 * und die Tagesbilanz. Actions (Abhaken / Tauschen / Rezept) werden per
 * Callback nach oben delegiert.
 */
import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Repeat,
  Loader2,
  ChevronDown,
} from "lucide-react";

export type DayPlanMeal = {
  id: string;
  /** Originaler Slot-Name aus dem Plan (z.B. "Frühstück", "Snack 1", "Pre-Workout"). */
  slotName: string;
  /** Gericht / Titel. */
  title: string;
  /** Optionale Beschreibung; wird für die Zutatenliste geparst. */
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  isTracked: boolean;
  busy?: boolean;
  hasRecipe?: boolean;
  canSwap?: boolean;
  hasOverride?: boolean;
  /** Beliebiger Zusatz-Content (z.B. Coach-Debug, Override-Banner). */
  extra?: React.ReactNode;
};

type Props = {
  /** "Dienstag, 14.07." */
  dateLabel: string;
  dayKind: "training" | "rest" | null;
  targets: {
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
  eaten: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  onPrevDay?: () => void;
  onNextDay?: () => void;
  meals: DayPlanMeal[];
  canTrack: boolean;
  onToggle?: (mealId: string) => void;
  onSwap?: (mealId: string) => void;
  onRecipe?: (mealId: string) => void;
  /** Optionaler Hinweis unter dem Tageskopf. */
  headerNote?: React.ReactNode;
};

type Section = "morning" | "noon" | "training" | "evening";
type Classified = DayPlanMeal & {
  section: Section;
  label: string;
  isSnack: boolean;
  order: number;
};

const SECTION_LABEL: Record<Section, string> = {
  morning: "Morgen",
  noon: "Mittag",
  training: "Rund ums Training",
  evening: "Abend",
};

/** Heuristische Klassifikation eines Slot-Namens. */
function baseClassify(name: string): Omit<Classified, keyof DayPlanMeal> | null {
  const n = name.toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n))
    return { section: "morning", label: "Frühstück", isSnack: false, order: 0 };
  if (/vormittag/.test(n))
    return { section: "morning", label: "Vormittagssnack", isSnack: true, order: 1 };
  if (/mittag|lunch/.test(n))
    return { section: "noon", label: "Mittagessen", isSnack: false, order: 2 };
  if (/pre[- ]?workout|pre[- ]?wo\b/.test(n))
    return { section: "training", label: "Pre-Workout", isSnack: true, order: 3 };
  if (/post[- ]?workout|post[- ]?wo\b/.test(n))
    return { section: "training", label: "Post-Workout", isSnack: true, order: 4 };
  if (/nachmittag/.test(n))
    return { section: "training", label: "Nachmittagssnack", isSnack: true, order: 4 };
  if (/(sp(ä|a)t|abend|nacht)[- ]?snack/.test(n))
    return { section: "evening", label: "Abendsnack", isSnack: true, order: 6 };
  if (/abend(essen)?|dinner/.test(n))
    return { section: "evening", label: "Abendessen", isSnack: false, order: 5 };
  if (/snack|shake|riegel|zwischen/.test(n))
    return { section: "morning", label: "", isSnack: true, order: 99 };
  return null;
}

/** Verteilt Meals auf Sections und benennt generische Snacks sinnvoll. */
function classify(meals: DayPlanMeal[]): Classified[] {
  const preliminary = meals.map((m, i) => {
    const c = baseClassify(m.slotName);
    return {
      meal: m,
      idx: i,
      c: c ?? { section: "morning" as Section, label: "", isSnack: true, order: 99 },
    };
  });

  // Positionen der Hauptmahlzeiten für Snack-Zuordnung
  const idxBreakfast = preliminary.findIndex((p) => p.c.label === "Frühstück");
  const idxLunch = preliminary.findIndex((p) => p.c.label === "Mittagessen");
  const idxDinner = preliminary.findIndex((p) => p.c.label === "Abendessen");

  const results: Classified[] = preliminary.map(({ meal, idx, c }) => ({
    ...meal,
    ...c,
  }));

  // Generische Snacks (order 99) einer Section zuordnen
  const genericSnacks = results
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.isSnack && x.r.order === 99);

  for (const { r, i } of genericSnacks) {
    let section: Section = "morning";
    if (idxDinner >= 0 && i > idxDinner) section = "evening";
    else if (idxLunch >= 0 && i > idxLunch) section = "training";
    else if (idxBreakfast >= 0 && i > idxBreakfast) section = "morning";
    r.section = section;
    r.order = section === "morning" ? 1 : section === "training" ? 4 : 6;
  }

  // Snacks innerhalb einer Section sinnvoll benennen
  for (const section of ["morning", "training", "evening"] as Section[]) {
    const snacks = results.filter((r) => r.section === section && r.isSnack);
    // Snacks mit expliziter Bezeichnung nicht überschreiben
    const generic = snacks.filter((s) => !s.label);
    if (generic.length === 0) continue;

    const defaults: Record<Section, string[]> = {
      morning: ["Vormittagssnack"],
      training: ["Pre-Workout", "Post-Workout"],
      evening: ["Abendsnack"],
      noon: [],
    };
    const pool = defaults[section];
    generic.forEach((s, i) => {
      s.label = pool[i] ?? `Snack ${i + 1}`;
    });
  }

  // Sortierung: section-Reihenfolge, dann interner order, dann ursprüngliche Reihenfolge
  const sectionRank: Record<Section, number> = {
    morning: 0,
    noon: 1,
    training: 2,
    evening: 3,
  };
  return results.sort((a, b) => {
    if (sectionRank[a.section] !== sectionRank[b.section])
      return sectionRank[a.section] - sectionRank[b.section];
    return a.order - b.order;
  });
}

/** Beschreibung → Zutatenliste. Erste "instruction sentence" bricht ab. */
const INSTRUCTION_SIGNALS = [
  "alles",
  "zubereit",
  "anleitung",
  "zusammen",
  "mischen",
  "kochen",
  "backen",
  "braten",
  "garen",
  "dünsten",
  "dämpfen",
  "grillen",
  "schneiden",
  "rühren",
  "unterheben",
  "vermengen",
  "in eine",
  "in den",
  "in die",
  "auf dem",
  "im ofen",
  "erhitzen",
  "abkühlen",
  "kühlschrank",
  "über nacht",
  "pfanne",
  "topf",
  "schüssel",
  "mixen",
  "pürieren",
  "aufschlagen",
  "verrühren",
];

function parseIngredients(desc: string | null): string[] {
  if (!desc) return [];
  // Split by newlines or bullets first, else by commas
  let parts = desc
    .split(/\r?\n|\s*[•·|]\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    parts = desc
      .split(/,(?![^()]*\))/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const out: string[] = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (INSTRUCTION_SIGNALS.some((sig) => low.startsWith(sig))) break;
    if (p.length > 120) break; // wahrscheinlich Anleitung
    out.push(p);
  }
  return out;
}

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MealCard({
  m,
  canTrack,
  compact,
  onToggle,
  onSwap,
  onRecipe,
}: {
  m: Classified;
  canTrack: boolean;
  compact: boolean;
  onToggle?: (id: string) => void;
  onSwap?: (id: string) => void;
  onRecipe?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ingredients = useMemo(() => parseIngredients(m.description), [m.description]);
  const showRecipe = !!m.hasRecipe && !!onRecipe;
  const showSwap = !!m.canSwap && !!onSwap;
  const dim = m.isTracked ? "opacity-70" : "";
  const macros = (
    <div className="mt-1 text-[11px] text-muted-foreground">
      {m.kcal != null && <span>{m.kcal} kcal</span>}
      {m.protein_g != null && <span> · P {m.protein_g}g</span>}
      {m.carbs_g != null && <span> · KH {m.carbs_g}g</span>}
      {m.fat_g != null && <span> · F {m.fat_g}g</span>}
    </div>
  );

  return (
    <div
      className={`rounded-[18px] border ${
        m.isTracked ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
      } p-4 transition ${dim}`}
    >
      <div className="flex items-start gap-3">
        {canTrack && onToggle ? (
          <button
            type="button"
            onClick={() => onToggle(m.id)}
            disabled={m.busy}
            aria-label={m.isTracked ? "Mahlzeit-Haken entfernen" : "Mahlzeit abhaken"}
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
              m.isTracked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/60"
            } disabled:opacity-50`}
          >
            {m.busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : m.isTracked ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
          </button>
        ) : (
          <span className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {m.label}
              </div>
              <div className="truncate text-sm font-bold text-foreground">
                {m.title}
              </div>
            </div>
            {m.kcal != null && (
              <div className="shrink-0 text-xs font-semibold text-primary">
                {m.kcal} kcal
              </div>
            )}
          </div>

          {!compact && ingredients.length > 0 && (
            <div className="mt-2">
              <ul className="space-y-0.5 text-[12px] text-foreground/80">
                {(expanded ? ingredients : ingredients.slice(0, 3)).map((ing, i) => (
                  <li key={i} className="leading-snug">
                    {ing}
                  </li>
                ))}
              </ul>
              {ingredients.length > 3 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                  {expanded
                    ? "weniger anzeigen"
                    : `+ ${ingredients.length - 3} weitere Zutaten`}
                </button>
              )}
            </div>
          )}

          {macros}

          {m.extra}

          {(showSwap || showRecipe) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {showSwap && (
                <button
                  type="button"
                  onClick={() => onSwap!(m.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  <Repeat className="h-3 w-3" /> Tauschen
                </button>
              )}
              {showRecipe && (
                <button
                  type="button"
                  onClick={() => onRecipe!(m.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  <BookOpen className="h-3 w-3" /> Rezept ansehen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DayPlanView({
  dateLabel,
  dayKind,
  targets,
  eaten,
  onPrevDay,
  onNextDay,
  meals,
  canTrack,
  onToggle,
  onSwap,
  onRecipe,
  headerNote,
}: Props) {
  const classified = useMemo(() => classify(meals), [meals]);
  const bySection = useMemo(() => {
    const map: Record<Section, Classified[]> = {
      morning: [],
      noon: [],
      training: [],
      evening: [],
    };
    for (const m of classified) map[m.section].push(m);
    return map;
  }, [classified]);

  const hasAnyTracked = classified.some((m) => m.isTracked);

  return (
    <div className="space-y-3">
      {/* Tageskopf */}
      <div className="rounded-[20px] border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dateLabel || "Tag"}
            </div>
            {dayKind && (
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  dayKind === "training"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {dayKind === "training" ? "Trainingstag" : "Restday"}
              </span>
            )}
          </div>
          {(onPrevDay || onNextDay) && (
            <div className="flex shrink-0 items-center gap-1">
              {onPrevDay && (
                <button
                  type="button"
                  onClick={onPrevDay}
                  aria-label="Vorheriger Tag"
                  className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-primary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {onNextDay && (
                <button
                  type="button"
                  onClick={onNextDay}
                  aria-label="Nächster Tag"
                  className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-primary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {targets && (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-display text-3xl font-bold leading-none">
                {targets.kcal ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">kcal</div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Protein {targets.protein_g ?? "—"} g · Kohlenhydrate{" "}
              {targets.carbs_g ?? "—"} g · Fett {targets.fat_g ?? "—"} g
            </div>
            <div className="mt-3 space-y-1">
              <ProgressBar current={eaten.kcal} max={targets.kcal ?? 0} />
              <div className="text-[11px] text-muted-foreground">
                {eaten.kcal} / {targets.kcal ?? "—"} kcal gegessen
              </div>
            </div>
          </>
        )}
        {headerNote && <div className="mt-3">{headerNote}</div>}
      </div>

      {/* Sections */}
      {(["morning", "noon", "training", "evening"] as Section[]).map((section) => {
        const list = bySection[section];
        if (!list.length) return null;
        const mains = list.filter((m) => !m.isSnack);
        const snacks = list.filter((m) => m.isSnack);
        return (
          <section key={section} className="space-y-2">
            <div className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              {SECTION_LABEL[section]}
            </div>

            {mains.map((m) => (
              <MealCard
                key={m.id}
                m={m}
                canTrack={canTrack}
                compact={false}
                onToggle={onToggle}
                onSwap={onSwap}
                onRecipe={onRecipe}
              />
            ))}

            {snacks.length > 0 && (
              <div className="divide-y divide-border/60 rounded-[18px] border border-border bg-background/40">
                {snacks.map((m) => (
                  <div key={m.id} className="p-1">
                    <MealCard
                      m={m}
                      canTrack={canTrack}
                      compact={true}
                      onToggle={onToggle}
                      onSwap={onSwap}
                      onRecipe={onRecipe}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {classified.length === 0 && (
        <p className="rounded-[18px] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Keine Mahlzeiten für diesen Tag.
        </p>
      )}

      {/* Tagesbilanz */}
      {hasAnyTracked && targets && (
        <div className="mt-2 rounded-[20px] border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Tagesbilanz
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <BalanceRow label="Geplant" value={`${targets.kcal ?? "—"} kcal`} />
            <BalanceRow label="Gegessen" value={`${eaten.kcal} kcal`} />
            <BalanceRow
              label="Differenz"
              value={`${
                targets.kcal != null
                  ? (eaten.kcal - targets.kcal >= 0 ? "+" : "") +
                    (eaten.kcal - targets.kcal)
                  : "—"
              } kcal`}
              accent={
                targets.kcal != null && Math.abs(eaten.kcal - targets.kcal) > 100
              }
            />
            <BalanceRow
              label="Protein"
              value={`${eaten.protein_g} / ${targets.protein_g ?? "—"} g`}
            />
            <BalanceRow
              label="Kohlenhydrate"
              value={`${eaten.carbs_g} / ${targets.carbs_g ?? "—"} g`}
            />
            <BalanceRow
              label="Fett"
              value={`${eaten.fat_g} / ${targets.fat_g ?? "—"} g`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent ? "text-amber-400" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

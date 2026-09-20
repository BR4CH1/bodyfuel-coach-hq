/**
 * Gemeinsame Typen & Labels für Tagesarten und Zusatzaktivitäten im
 * Trainingsbuilder.
 *
 * Wichtig:
 * - "Flex-Aktivität" ist ein eigener Tagestyp und ausdrücklich KEIN
 *   zusätzlicher Krafttrainingstag.
 * - Es werden KEINE Kalorienverbräuche geschätzt. Flex-Aktivitäten liefern
 *   nur Dauer und Intensität; die Ernährung bleibt dadurch neutral.
 */

export type FlexActivitySport =
  | "padel"
  | "tennis"
  | "fussball"
  | "laufen"
  | "radfahren"
  | "schwimmen"
  | "sonstige";

export const FLEX_SPORT_LABELS: Record<FlexActivitySport, string> = {
  padel: "Padel",
  tennis: "Tennis",
  fussball: "Fußball",
  laufen: "Laufen",
  radfahren: "Radfahren",
  schwimmen: "Schwimmen",
  sonstige: "Sonstige",
};

export const FLEX_SPORTS = Object.keys(FLEX_SPORT_LABELS) as FlexActivitySport[];

export type ActivityIntensity = "niedrig" | "mittel" | "hoch";

export const ACTIVITY_INTENSITY_LABELS: Record<ActivityIntensity, string> = {
  niedrig: "niedrig",
  mittel: "mittel",
  hoch: "hoch",
};

export const ACTIVITY_INTENSITIES = Object.keys(
  ACTIVITY_INTENSITY_LABELS,
) as ActivityIntensity[];

/** Tagesarten im Trainingsbuilder — klar voneinander getrennt. */
export type TrainingDayKind = "strength" | "cardio" | "recovery" | "flex";

export const TRAINING_DAY_KIND_LABELS: Record<TrainingDayKind, string> = {
  strength: "Krafttraining",
  cardio: "Cardio",
  recovery: "Recovery",
  flex: "Flex-Aktivität",
};

export function isFlexActivitySport(value: unknown): value is FlexActivitySport {
  return typeof value === "string" && (FLEX_SPORTS as string[]).includes(value);
}

export function isActivityIntensity(value: unknown): value is ActivityIntensity {
  return typeof value === "string" && (ACTIVITY_INTENSITIES as string[]).includes(value);
}

/** Dauer in Minuten, robust begrenzt (0 = nicht gesetzt → null). */
export function clampActivityDuration(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(600, Math.round(n));
}

export type ActivityLoadInput = {
  type: string;
  durationMin?: number | null;
  intensity?: ActivityIntensity | null;
};

export type WeeklyLoadSummary = {
  /** Flex-Aktivitäten werden getrennt von Krafttraining gezählt. */
  flexCount: number;
  flexMinutes: number;
  cardioCount: number;
  cardioMinutes: number;
  recoveryCount: number;
  otherCount: number;
  /** Gesamtbelastung aller Zusatzaktivitäten in Minuten. */
  totalMinutes: number;
  totalCount: number;
};

/**
 * Fasst Zusatzaktivitäten einer Woche zusammen. Flex bleibt separat
 * ausgewiesen, zählt aber in die Gesamtbelastung hinein.
 */
export function summarizeWeeklyActivityLoad(
  days: Array<{ activities?: ActivityLoadInput[] | null }>,
): WeeklyLoadSummary {
  const summary: WeeklyLoadSummary = {
    flexCount: 0,
    flexMinutes: 0,
    cardioCount: 0,
    cardioMinutes: 0,
    recoveryCount: 0,
    otherCount: 0,
    totalMinutes: 0,
    totalCount: 0,
  };
  for (const day of days ?? []) {
    for (const activity of day.activities ?? []) {
      const minutes = clampActivityDuration(activity.durationMin) ?? 0;
      summary.totalCount += 1;
      summary.totalMinutes += minutes;
      if (activity.type === "flex") {
        summary.flexCount += 1;
        summary.flexMinutes += minutes;
      } else if (activity.type === "cardio") {
        summary.cardioCount += 1;
        summary.cardioMinutes += minutes;
      } else if (activity.type === "mobility") {
        summary.recoveryCount += 1;
      } else {
        summary.otherCount += 1;
      }
    }
  }
  return summary;
}

/**
 * Ernährungs-Tagesart für eine Tagesart des Trainings.
 *
 * Flex-Aktivitäten werden NICHT pauschal wie Krafttraining behandelt: ohne
 * validiertes Verbrauchsmodell bleiben sie neutral (Ruhetag-Ziele), es sei
 * denn der Coach behandelt sie ausdrücklich als Trainingstag.
 */
export function nutritionDayTypeForKind(
  kind: TrainingDayKind,
  options: { flexCountsAsTraining?: boolean } = {},
): "training" | "rest" {
  if (kind === "strength") return "training";
  if (kind === "cardio") return "training";
  if (kind === "flex") return options.flexCountsAsTraining ? "training" : "rest";
  return "rest";
}

/** Lesbare Kurzbeschreibung einer Flex-Aktivität, z. B. "Padel · 90 Min · hoch". */
export function describeFlexActivity(activity: {
  title?: string | null;
  sport?: FlexActivitySport | null;
  durationMin?: number | null;
  intensity?: ActivityIntensity | null;
}): string {
  const parts: string[] = [];
  const label = activity.title?.trim() || (activity.sport ? FLEX_SPORT_LABELS[activity.sport] : "");
  if (label) parts.push(label);
  const minutes = clampActivityDuration(activity.durationMin);
  if (minutes) parts.push(`${minutes} Min`);
  if (activity.intensity) parts.push(ACTIVITY_INTENSITY_LABELS[activity.intensity]);
  return parts.join(" · ");
}

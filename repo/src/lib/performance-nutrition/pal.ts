/**
 * Day-type → PAL category resolution.
 * Pure. No engine coupling beyond constants.
 */
import {
  BASELINE_ACTIVITY_PAL,
  FOOTBALL_POSITION_DEFAULT_PAL,
  PAL_RANK,
  SESSION_INTENSITY_PAL_SHIFT,
  type BaselineDailyActivity,
  type FootballPositionCluster,
  type PalCategory,
  type PerformanceDayType,
  type SessionIntensity,
  palFromRank,
} from "./constants";

export function getBaselinePal(activity: BaselineDailyActivity | null): PalCategory {
  return activity ? BASELINE_ACTIVITY_PAL[activity] : "LOW_ACTIVE";
}

export function getFootballTrainingPal(cluster: FootballPositionCluster): PalCategory {
  return FOOTBALL_POSITION_DEFAULT_PAL[cluster];
}

/** Applies session intensity to a football training PAL. Clamped to [LOW_ACTIVE, VERY_ACTIVE]. */
export function applySessionIntensity(
  basePal: PalCategory,
  intensity: SessionIntensity,
): PalCategory {
  const shift = SESSION_INTENSITY_PAL_SHIFT[intensity];
  const rank = PAL_RANK[basePal] + shift;
  // never lower than LOW_ACTIVE (=1) on a training day, never above VERY_ACTIVE (=3)
  const clamped = Math.max(PAL_RANK.LOW_ACTIVE, Math.min(PAL_RANK.VERY_ACTIVE, rank));
  return palFromRank(clamped);
}

function maxPal(a: PalCategory, b: PalCategory): PalCategory {
  return PAL_RANK[a] >= PAL_RANK[b] ? a : b;
}

export interface DayPalInput {
  dayType: PerformanceDayType;
  baseline: BaselineDailyActivity | null;
  positionCluster: FootballPositionCluster | null;
  sessionIntensity: SessionIntensity | null;
}

/**
 * Compute the PAL category for a specific day.
 * Football days without a resolvable cluster fall back to ACTIVE (or baseline, whichever is higher).
 */
export function getDayPalCategory(input: DayPalInput): PalCategory {
  const { dayType, baseline, positionCluster, sessionIntensity } = input;
  const basePal = getBaselinePal(baseline);

  switch (dayType) {
    case "REST":
    case "RECOVERY":
      return basePal;

    case "STRENGTH":
      return maxPal(basePal, "ACTIVE");

    case "FOOTBALL_TRAINING":
    case "SPEED":
    case "CONDITIONING": {
      const cluster: FootballPositionCluster = positionCluster ?? "HYBRID";
      let footballPal = getFootballTrainingPal(cluster);
      const intensity: SessionIntensity = sessionIntensity ?? "MODERATE";
      footballPal = applySessionIntensity(footballPal, intensity);
      return maxPal(basePal, footballPal);
    }

    case "GAME_DAY":
    case "DOUBLE_SESSION":
      return "VERY_ACTIVE";
  }
}

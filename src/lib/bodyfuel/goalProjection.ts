// Shared calorie / goal projection helpers used by client and coach views.

export type GoalProfile = {
  height_cm?: number | null;
  birthdate?: string | null;
  gender?: string | null;
  goal_weight_kg?: number | null;
  goal_target_date?: string | null;
  activity_level?: string | null;
};

export type GoalHint = {
  rate: number;            // kg/week (signed)
  ratePctWeek: number;     // |rate|/weight * 100
  kcal: number;            // recommended daily kcal
  delta: number;           // daily kcal delta vs TDEE
  weeks: number;
  intensity: "moderat" | "ambitioniert" | "aggressiv";
  clamped: boolean;
  isLoss: boolean;
  tdee: number;
};

function activityFactor(level?: string | null) {
  return level === "sedentary" ? 1.3 :
         level === "light" ? 1.45 :
         level === "moderate" ? 1.6 :
         level === "active" ? 1.75 :
         level === "athlete" ? 1.9 : 1.55;
}

export function estimateTdee(weight: number, profile: GoalProfile): number {
  const age = profile.birthdate
    ? Math.floor((Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 86400000))
    : null;
  if (profile.height_cm && age && profile.gender) {
    const bmr = profile.gender === "female"
      ? 10 * weight + 6.25 * profile.height_cm - 5 * age - 161
      : 10 * weight + 6.25 * profile.height_cm - 5 * age + 5;
    return bmr * activityFactor(profile.activity_level);
  }
  return weight * 33;
}

function kcalFor(weight: number, delta: number, profile: GoalProfile): number {
  const tdee = estimateTdee(weight, profile);
  const minKcal = profile.gender === "female" ? 1200 : 1500;
  let kcal = Math.round((tdee + delta) / 50) * 50;
  if (kcal < minKcal) kcal = Math.round(minKcal / 50) * 50;
  return kcal;
}

export function computeGoalHint(currentWeight: number | null | undefined, profile: GoalProfile): GoalHint | null {
  const w = currentWeight;
  const gw = profile.goal_weight_kg;
  const td = profile.goal_target_date;
  if (!w || !gw || !td) return null;
  const target = new Date(td);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = (target.getTime() - today.getTime()) / 86400000;
  if (days <= 0) return null;
  const weeks = Math.max(2, days / 7);
  const kgDiff = Number(gw) - Number(w);
  if (Math.abs(kgDiff) < 0.1) return null;
  const rate = kgDiff / weeks;
  let delta = (rate * 7700) / 7;
  const maxDeficit = -(Number(w) * 0.01) * 7700 / 7;
  const maxSurplus = (Number(w) * 0.005) * 7700 / 7;
  let clamped = false;
  if (delta < maxDeficit) { delta = maxDeficit; clamped = true; }
  if (delta > maxSurplus) { delta = maxSurplus; clamped = true; }
  const tdee = estimateTdee(Number(w), profile);
  const minKcal = profile.gender === "female" ? 1200 : 1500;
  let kcal = Math.round((tdee + delta) / 50) * 50;
  if (kcal < minKcal) kcal = Math.round(minKcal / 50) * 50;
  const ratePctWeek = Math.abs(rate) / Number(w) * 100;
  const isLoss = kgDiff < 0;
  let intensity: "moderat" | "ambitioniert" | "aggressiv" = "moderat";
  if (ratePctWeek >= 0.75) intensity = "aggressiv";
  else if (ratePctWeek >= 0.5) intensity = "ambitioniert";
  return {
    rate, ratePctWeek, kcal, delta: Math.round(delta),
    weeks: Math.round(weeks), intensity, clamped, isLoss, tdee,
  };
}

export type TimelineStep = {
  weight: number;       // milestone weight (kg)
  deltaKg: number;      // signed kg from current
  kcal: number;         // recommended kcal at this weight (delta held constant)
  tdee: number;
  weeksFromNow: number; // est. weeks to reach
  etaDate: string;      // ISO date
};

/** Timeline in 5-kg increments toward the goal. */
export function buildCalorieTimeline(
  currentWeight: number | null | undefined,
  profile: GoalProfile,
  hint: GoalHint | null,
  stepKg = 5,
): TimelineStep[] {
  if (!currentWeight || !profile.goal_weight_kg || !hint) return [];
  const w0 = Number(currentWeight);
  const gw = Number(profile.goal_weight_kg);
  const sign = gw > w0 ? 1 : -1;
  const totalDiff = Math.abs(gw - w0);
  if (totalDiff < 0.1) return [];
  const steps: TimelineStep[] = [];
  const ratePerWeek = Math.abs(hint.rate); // kg/week clamped already? rate is raw; use clamped delta
  // Recompute effective rate from clamped delta: kg/week = delta*7/7700
  const effectiveRate = Math.abs((hint.delta * 7) / 7700) || ratePerWeek;
  const today = new Date();
  for (let i = 1; i * stepKg <= totalDiff + 0.001; i++) {
    const deltaKg = sign * i * stepKg;
    const weight = +(w0 + deltaKg).toFixed(1);
    const kcal = kcalFor(weight, hint.delta, profile);
    const tdee = estimateTdee(weight, profile);
    const weeksFromNow = effectiveRate > 0 ? (i * stepKg) / effectiveRate : 0;
    const eta = new Date(today.getTime() + weeksFromNow * 7 * 86400000);
    steps.push({
      weight, deltaKg, kcal, tdee,
      weeksFromNow: Math.round(weeksFromNow * 10) / 10,
      etaDate: eta.toISOString().slice(0, 10),
    });
  }
  // Always include the final goal weight if it isn't a multiple of stepKg
  const lastStepWeight = steps.length ? steps[steps.length - 1].weight : w0;
  if (Math.abs(lastStepWeight - gw) > 0.1) {
    const kcal = kcalFor(gw, hint.delta, profile);
    const tdee = estimateTdee(gw, profile);
    const weeksFromNow = effectiveRate > 0 ? Math.abs(gw - w0) / effectiveRate : 0;
    const eta = new Date(today.getTime() + weeksFromNow * 7 * 86400000);
    steps.push({
      weight: gw, deltaKg: gw - w0, kcal, tdee,
      weeksFromNow: Math.round(weeksFromNow * 10) / 10,
      etaDate: eta.toISOString().slice(0, 10),
    });
  }
  return steps;
}

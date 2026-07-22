/**
 * Shared BodyFuel protein policy.
 *
 * Protein is intentionally kept between 1.6 and 2.0 g/kg. Calories that are
 * removed by the hard cap are shifted to carbohydrates (both provide 4 kcal/g)
 * so the configured calorie target stays unchanged.
 */
export const MAX_PROTEIN_G_PER_KG = 2;

export function proteinFactorForGoal(goal: string | null | undefined): number {
  const normalized = String(goal ?? "")
    .trim()
    .toLowerCase();

  if (["fat_loss", "weight_loss", "cut", "aggressive_cut"].includes(normalized)) {
    return 2;
  }

  if (
    ["lean_bulk", "bulk", "muscle_gain", "strength", "strength_gain", "recovery", "rehab"].includes(
      normalized,
    )
  ) {
    return 1.8;
  }

  return 1.6;
}

export function calculateProteinTarget(weightKg: number, goal: string | null | undefined): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  return Math.min(
    Math.floor(weightKg * MAX_PROTEIN_G_PER_KG),
    Math.round(weightKg * proteinFactorForGoal(goal)),
  );
}

export function getProteinCap(weightKg: number | null | undefined): number | null {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return Math.floor(weight * MAX_PROTEIN_G_PER_KG);
}

export function capProteinAndShiftToCarbs(input: {
  proteinG: number;
  carbsG: number;
  weightKg: number | null | undefined;
}) {
  const rawProtein = Math.max(0, Math.round(Number(input.proteinG) || 0));
  const rawCarbs = Math.max(0, Math.round(Number(input.carbsG) || 0));
  const cap = getProteinCap(input.weightKg);
  const proteinG = cap == null ? rawProtein : Math.min(rawProtein, cap);

  return {
    proteinG,
    carbsG: rawCarbs + (rawProtein - proteinG),
    capped: proteinG < rawProtein,
    cap,
  };
}

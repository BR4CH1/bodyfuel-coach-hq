import type { Meal, NutritionTargets } from "./types";

export const MEALS: { key: Meal; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Frühstück", emoji: "🥐" },
  { key: "lunch", label: "Mittag", emoji: "🍱" },
  { key: "dinner", label: "Abend", emoji: "🍽️" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

export const DEFAULT_TARGETS: NutritionTargets = {
  kcal: 2200,
  protein_g: 150,
  carbs_g: 220,
  fat_g: 70,
  water_glasses: 8,
};

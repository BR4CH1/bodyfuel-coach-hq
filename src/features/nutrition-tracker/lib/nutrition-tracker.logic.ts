import type { FoodResult } from "@/lib/nutrition.functions";
import { amountToGrams, macroFactorForAmount } from "@/lib/food-units";
import type { FoodEntry, FoodUnit, NutritionTotals } from "../types";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftIsoDate(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function normalizeFoodSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compactFoodSearchTerm(value: string): string {
  return normalizeFoodSearchTerm(value).replace(/\s+/g, "");
}

export function localFoodMatches(value: string, term: string): boolean {
  const haystack = normalizeFoodSearchTerm(value);
  const compactHaystack = compactFoodSearchTerm(value);
  const needle = normalizeFoodSearchTerm(term);
  const compactNeedle = compactFoodSearchTerm(term);
  const tokens = needle.split(/\s+/).filter(Boolean);

  return (
    haystack.includes(needle) ||
    compactHaystack.includes(compactNeedle) ||
    tokens.every((token) => haystack.includes(token) || compactHaystack.includes(token))
  );
}

export function favoriteKey(food: {
  barcode?: string | null;
  name: string;
  brand?: string | null;
}): string {
  return `${food.barcode ?? food.name}|${food.brand ?? ""}`;
}

export function calculateNutritionTotals(entries: FoodEntry[]): NutritionTotals {
  return entries.reduce<NutritionTotals>(
    (total, entry) => ({
      kcal: total.kcal + Number(entry.kcal),
      protein_g: total.protein_g + Number(entry.protein_g),
      carbs_g: total.carbs_g + Number(entry.carbs_g),
      fat_g: total.fat_g + Number(entry.fat_g),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function parseFoodAmount(value: string): number {
  return Number.parseFloat(value.replace(",", ".")) || 0;
}

export function amountInGrams(food: FoodResult, unit: FoodUnit, amount: number): number {
  return amountToGrams({ ...food, unit }, amount);
}

export function nutritionFactorForAmount(amount: number): number {
  return macroFactorForAmount(amount);
}

export function cleanPlanEntryName(name: string, source: string | null): string {
  if (!source?.startsWith("plan:")) return name;

  return name.replace(
    /^\s*(Frühstück|Mittagessen|Mittag|Abendessen|Abend|Snack|Spätsnack|Late[- ]?Night|Pre[- ]?Workout|Post[- ]?Workout|Shake|Mahlzeit\s*\d+)\s*[—–\-:]\s*/i,
    "",
  );
}

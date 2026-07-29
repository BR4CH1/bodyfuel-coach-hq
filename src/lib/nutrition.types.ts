import type { FoodAmountUnit } from "@/lib/food-units";

export type FoodSource =
  | "bls_4_0"
  | "bodyfuel_verified"
  | "open_food_facts"
  | "usda"
  | "ai_estimate"
  | "barcode"
  | "manual"
  | null;

export type FoodResult = {
  id?: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  /** Eingabe- und Referenzeinheit: Flüssigkeiten ml, alle anderen Lebensmittel g. */
  unit: FoodAmountUnit;
  /** Nur für Flüssigkeiten; dient der Legacy-Massenablage, nicht der Makro-Skalierung. */
  density_g_per_ml: number | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  salt_per_100g?: number | null;
  sodium_mg_per_100g?: number | null;
  /** Gramm pro Stück/Portion (z.B. 1 Scheibe Toast = 25g), falls bekannt */
  serving_g: number | null;
  /** Roh-Label, z.B. "pro 100 g" */
  serving_label: string | null;
  /** Datenquelle (bls_4_0, bodyfuel_verified, open_food_facts, usda, ai_estimate, …) */
  source?: FoodSource;
  /** True wenn Coach geprüft */
  verified_by_coach?: boolean;
  image_url?: string | null;
  image_source?: string | null;
  /** true, wenn der kcal-Wert unplausibel war und aus den Makros korrigiert wurde. */
  energy_flagged?: boolean;
  energy_note?: string | null;
  /** Synonyme aus dem Katalog — nur für Relevanz-Ranking, nicht für die Anzeige. */
  aliases?: string[] | null;
};

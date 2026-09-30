import { describe, expect, it } from "vitest";
import type { BuilderDay, CustomerPlanContext } from "@/lib/plan-builder.functions";
import {
  averagePlanTotals,
  customTargetsToRow,
  loadCustomTargets,
  resolvePersistedMealMacros,
  targetDeviation,
} from "../builder-persist.logic";
import { mealMacros, summarizeDay, targetsFor } from "../plan-builder.logic";

const ctx = {
  targets: {
    kcal_train: 2600, protein_train: 180, carbs_train: 300, fat_train: 75,
    kcal_rest: 2200, protein_rest: 170, carbs_rest: 210, fat_rest: 80,
  },
} as unknown as CustomerPlanContext;

const library = [{ id: "lib", kcal: 700, protein_g: 52, carbs_g: 57, fat_g: 28 }] as any;

describe("Save → Load Round-trip", () => {
  it("speichert Builder-Werte statt niedrigerer Engine-Neuberechnung und lädt sie identisch", () => {
    const meal = { slot: "lunch", name: "Bowl", library_meal_id: "lib", ingredients: [], portion_factor: 1.2 } as any;
    const builder = mealMacros(meal, library);
    const saved = resolvePersistedMealMacros(builder, { kcal: 310, protein_g: 20, carbs_g: 10, fat_g: 5 });
    expect(saved).toMatchObject({ kcal: 840, protein_g: 62, carbs_g: 68, fat_g: 34, source: "builder" });
    // Laden: gespeicherte Werte werden macro_override mit Portion 1
    const loaded = { ...meal, portion_factor: 1, macro_override: saved };
    expect(Math.round(mealMacros(loaded, []).kcal)).toBe(saved.kcal);
  });

  it("Mahlzeit ohne Katalog-/Bibliothekstreffer fällt auf Engine-Werte zurück", () => {
    const meal = { slot: "snack", name: "Unbekannt", ingredients: [{ name: "xyz", grams: 50 }] } as any;
    const saved = resolvePersistedMealMacros(mealMacros(meal, []), { kcal: 120.4, protein_g: 5, carbs_g: 10, fat_g: 6 });
    expect(saved).toMatchObject({ kcal: 120, source: "engine" });
  });
});

describe("Manuelle Tagesziele", () => {
  it("bleiben unverändert und fehlende Makros werden nicht 0", () => {
    const row = customTargetsToRow({ kcal: 1150, p: 120, c: null, f: 40 });
    expect(row).toEqual({ target_kcal: 1150, target_protein_g: 120, target_carbs_g: null, target_fat_g: 40 });
    const loaded = loadCustomTargets(row)!;
    const day = { name: "T", type: "rest", meals: [], customTargets: loaded } as BuilderDay;
    expect(targetsFor(day, ctx)).toEqual({ kcal: 1150, p: 120, c: 210, f: 40 });
  });
  it("ohne gespeicherte Ziele kein individuelles Ziel", () => {
    expect(loadCustomTargets({ target_kcal: null })).toBeNull();
  });
});

describe("Übersicht & Warnung", () => {
  it("Plan-Durchschnitt entspricht Summe der Tagesansicht, kcal nicht auf 50 gerundet", () => {
    const meals = [
      { slot: "breakfast", name: "A", ingredients: [], macro_override: { kcal: 688, protein_g: 52, carbs_g: 57, fat_g: 28 } },
      { slot: "lunch", name: "B", ingredients: [], macro_override: { kcal: 535, protein_g: 40, carbs_g: 50, fat_g: 19 } },
    ] as any[];
    const day = { name: "T", type: "rest", meals } as BuilderDay;
    const summary = summarizeDay(day, ctx, []);
    const persisted = meals.map((m) => resolvePersistedMealMacros(mealMacros(m, []), null));
    expect(averagePlanTotals([persisted]).kcal).toBe(Math.round(summary.totals.kcal));
    expect(averagePlanTotals([persisted]).kcal).toBe(1223);
  });
  it("warnt bei +73 kcal über 1150, nicht bei Kleinstabweichung", () => {
    expect(targetDeviation(1223, 1150)).toMatchObject({ diff: 73, significant: true });
    expect(targetDeviation(1223, 1150).message).toContain("+73 kcal über");
    expect(targetDeviation(1170, 1150).significant).toBe(false);
  });
});

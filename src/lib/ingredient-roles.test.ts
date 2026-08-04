import { describe, expect, it } from "vitest";
import {
  classifyIngredientRole,
  detectFoodState,
  fallbackPer100,
  roleBounds,
  roundGrams,
} from "./ingredient-roles";

describe("detectFoodState", () => {
  it("erkennt gekochte Zustände", () => {
    expect(detectFoodState("Reis gekocht")).toBe("cooked");
    expect(detectFoodState("Kichererbsen abgetropft")).toBe("cooked");
    expect(detectFoodState("Kartoffeln gegart")).toBe("cooked");
  });

  it("erkennt rohe/trockene Zustände", () => {
    expect(detectFoodState("Reis (roh)")).toBe("raw");
    expect(detectFoodState("Linsen trocken")).toBe("raw");
    expect(detectFoodState("Quinoa (roh)")).toBe("raw");
  });

  it("gibt null zurück, wenn kein Zustand genannt ist", () => {
    expect(detectFoodState("Hähnchenbrust")).toBeNull();
  });
});

describe("fallbackPer100 – Roh/Gekocht", () => {
  it("liefert für 'Reis gekocht' realistische Gekocht-Werte, nicht den Rohwert", () => {
    const cooked = fallbackPer100("Reis gekocht")!;
    expect(cooked.carbs_g).toBeGreaterThan(20);
    expect(cooked.carbs_g).toBeLessThan(35);
    expect(cooked.kcal).toBeLessThan(180);

    const raw = fallbackPer100("Reis (roh)")!;
    expect(raw.carbs_g).toBeGreaterThan(70);
    expect(raw.kcal).toBeGreaterThan(300);
  });

  it.each([
    ["Vollkornnudeln gekocht", "Vollkornnudeln (roh)"],
    ["Quinoa gekocht", "Quinoa (roh)"],
    ["Couscous gekocht", "Couscous trocken"],
    ["Bulgur gekocht", "Bulgur trocken"],
    ["Hirse gekocht", "Hirse trocken"],
    ["Rote Linsen gekocht", "Linsen (roh)"],
    ["Kichererbsen gekocht", "Kichererbsen trocken"],
    ["Kidneybohnen gekocht", "Bohnen trocken"],
    ["Reisnudeln gekocht", "Reisnudeln trocken"],
  ])("%s hat deutlich weniger KH als %s", (cookedName, rawName) => {
    const cooked = fallbackPer100(cookedName)!;
    const raw = fallbackPer100(rawName)!;
    expect(cooked).toBeTruthy();
    expect(raw).toBeTruthy();
    expect(cooked.carbs_g).toBeLessThan(raw.carbs_g * 0.75);
    expect(cooked.kcal).toBeLessThan(raw.kcal);
  });

  it("wählt den spezifischsten Treffer", () => {
    expect(fallbackPer100("Vollkornreis gekocht")!.carbs_g).toBeCloseTo(21.3, 1);
    expect(fallbackPer100("Reisnudeln gekocht")!.carbs_g).toBeCloseTo(24.9, 1);
    // Namen, die "Reis" enthalten, aber keine Stärkebeilage sind
    expect(fallbackPer100("Blumenkohlreis")!.kcal).toBeLessThan(40);
    expect(fallbackPer100("Reiswaffeln")!.carbs_g).toBeGreaterThan(70);
  });

  it("nutzt plausible Standardzustände ohne Zustandsangabe", () => {
    // Beilagen werden als Trockengewicht geplant …
    expect(fallbackPer100("Reis")!.carbs_g).toBeGreaterThan(70);
    // … Kartoffeln und Hülsenfrüchte als verzehrfertige Menge.
    expect(fallbackPer100("Kichererbsen")!.carbs_g).toBeLessThan(25);
    expect(fallbackPer100("Kartoffeln")!.carbs_g).toBeLessThan(20);
  });

  it("gibt null für unbekannte Lebensmittel zurück (keine Schätzung)", () => {
    expect(fallbackPer100("Wunderpulver XY")).toBeNull();
    expect(fallbackPer100("")).toBeNull();
  });

  it("liefert konsistente Energie (4/4/9) für Fallbackwerte", () => {
    for (const name of ["Reis gekocht", "Hähnchenbrust", "Olivenöl", "Magerquark", "Banane"]) {
      const v = fallbackPer100(name)!;
      const computed = v.protein_g * 4 + v.carbs_g * 4 + v.fat_g * 9;
      expect(Math.abs(computed - v.kcal)).toBeLessThanOrEqual(Math.max(25, v.kcal * 0.12));
    }
  });
});

describe("classifyIngredientRole", () => {
  it.each([
    ["Reis gekocht", "carb"],
    ["Vollkornnudeln gekocht", "carb"],
    ["Haferflocken", "carb"],
    ["Hähnchenbrust", "protein"],
    ["Magerquark", "protein"],
    ["Tofu natur", "protein"],
    ["Olivenöl", "fat"],
    ["Mandeln", "fat"],
    ["Erdnussbutter", "fat"],
    ["Brokkoli", "vegetable"],
    ["Tomaten", "vegetable"],
    ["Gewürze", "vegetable"],
    ["Heidelbeeren", "fruit"],
  ])("%s → %s", (name, role) => {
    expect(classifyIngredientRole(name)).toBe(role);
  });

  it("nutzt die Makro-Heuristik nur ohne Marker-Treffer", () => {
    expect(
      classifyIngredientRole("Spezialriegel", { kcal: 400, protein_g: 5, carbs_g: 70, fat_g: 10 }),
    ).toBe("carb");
    expect(
      classifyIngredientRole("Spezialpulver", { kcal: 380, protein_g: 75, carbs_g: 8, fat_g: 4 }),
    ).toBe("protein");
  });
});

describe("roleBounds", () => {
  it("hält Gemüse und sonstige Zutaten unverändert", () => {
    expect(roleBounds("vegetable", 150)).toEqual({ min: 150, max: 150 });
    expect(roleBounds("other", 20)).toEqual({ min: 20, max: 20 });
  });

  it("erlaubt Kohlenhydratquellen große Spannen und optional 0 g", () => {
    expect(roleBounds("carb", 100)).toEqual({ min: 15, max: 250 });
    expect(roleBounds("carb", 100, { allowZero: true })).toEqual({ min: 0, max: 250 });
  });

  it("hält Proteinquellen weitgehend stabil", () => {
    expect(roleBounds("protein", 200)).toEqual({ min: 120, max: 400 });
  });

  it("liefert nie negative Mengen", () => {
    for (const role of ["carb", "protein", "fat", "fruit", "vegetable", "other"] as const) {
      const bounds = roleBounds(role, 0);
      expect(bounds.min).toBeGreaterThanOrEqual(0);
      expect(bounds.max).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("roundGrams", () => {
  it("rundet ab 40 g in 5-g-Schritten, darunter auf 1 g", () => {
    expect(roundGrams(123)).toBe(125);
    expect(roundGrams(41)).toBe(40);
    expect(roundGrams(18.4)).toBe(18);
    expect(roundGrams(-5)).toBe(0);
    expect(roundGrams(Number.NaN)).toBe(0);
  });
});

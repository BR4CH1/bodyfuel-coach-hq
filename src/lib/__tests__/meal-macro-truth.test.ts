import { describe, expect, it } from "vitest";

import {
  aggregateIngredientAmounts,
  formatIngredientLine,
  formatPartnerIngredientLines,
  ingredientsCarryMacros,
  parseDecimalAmount,
  reconcileMealMacros,
  scaleIngredientsByFactor,
  scaleIngredientToAmount,
  sumIngredientTotals,
  type TruthIngredient,
} from "../meal-macro-truth";

const rice: TruthIngredient = {
  name: "Reis, trocken",
  amount: 150,
  unit: "g",
  kcal: 540,
  protein_g: 10.5,
  carbs_g: 117,
  fat_g: 1.2,
};

const chicken: TruthIngredient = {
  name: "Hähnchenbrust",
  amount: 300,
  unit: "g",
  kcal: 330,
  protein_g: 69,
  carbs_g: 0,
  fat_g: 3.6,
};

describe("Portionierung von der stabilen Basis", () => {
  it("150 g → 80 g ist exakt proportional", () => {
    const scaled = scaleIngredientToAmount(rice, 80);
    expect(scaled.amount).toBe(80);
    expect(Number(scaled.kcal)).toBeCloseTo(288, 6);
    expect(Number(scaled.carbs_g)).toBeCloseTo(62.4, 6);
  });

  it("bleibt gleich, wenn der Nutzer 150 → 15 → 1 → 8 → 80 tippt", () => {
    const direct = scaleIngredientToAmount(rice, 80);
    let latest = rice;
    for (const step of [15, 1, 8, 80]) latest = scaleIngredientToAmount(rice, step);
    expect(Number(latest.kcal)).toBeCloseTo(Number(direct.kcal), 6);
    expect(latest.amount).toBe(80);
  });

  it("akzeptiert Dezimalmengen mit Komma", () => {
    expect(parseDecimalAmount("12,5")).toBe(12.5);
    const scaled = scaleIngredientToAmount(rice, "12,5");
    expect(scaled.amount).toBe(12.5);
    expect(Number(scaled.kcal)).toBeCloseTo(45, 6);
  });

  it("behält Trockengewicht als Trockengewicht (keine Einheiten-/Zustandswandlung)", () => {
    const scaled = scaleIngredientToAmount(rice, 80);
    expect(scaled.unit).toBe("g");
    expect(scaled.name).toBe("Reis, trocken");
  });

  it("lässt nicht skalierbare Zutaten unverändert", () => {
    const spice: TruthIngredient = { name: "Gewürze", kcal: 4 };
    expect(scaleIngredientToAmount(spice, 50)).toBe(spice);
  });
});

describe("Rezeptsumme aus den Zutaten", () => {
  it("summiert präzise und rundet nur am Ende", () => {
    expect(sumIngredientTotals([rice, chicken])).toEqual({
      kcal: 870,
      protein_g: 79.5,
      carbs_g: 117,
      fat_g: 4.8,
    });
  });

  it("ändert sich, wenn eine Zutat geändert wird", () => {
    const changed = [scaleIngredientToAmount(rice, 40), chicken];
    const totals = sumIngredientTotals(changed);
    expect(totals.kcal).toBe(474);
    expect(totals.carbs_g).toBeCloseTo(31.2, 1);
  });

  it("erkennt Zutaten ohne Nährwerte", () => {
    expect(ingredientsCarryMacros([{ name: "Mix", amount: 100, unit: "g" }])).toBe(false);
    expect(ingredientsCarryMacros([rice])).toBe(true);
  });
});

describe("Konsistenzprüfung gespeicherter Summen", () => {
  it("repariert einen absichtlich falschen gespeicherten Wert", () => {
    const result = reconcileMealMacros({
      stored: { kcal: 291, protein_g: 48, carbs_g: 9, fat_g: 6 },
      computed: sumIngredientTotals([rice, chicken]),
    });
    expect(result.corrected).toBe(true);
    expect(result.macros.kcal).toBe(870);
    expect(result.note).toContain("aus den Zutaten berechnet");
  });

  it("lässt konsistente Werte innerhalb der Rundungstoleranz unverändert", () => {
    const result = reconcileMealMacros({
      stored: { kcal: 869, protein_g: 79.4, carbs_g: 117, fat_g: 4.9 },
      computed: sumIngredientTotals([rice, chicken]),
    });
    expect(result.corrected).toBe(false);
  });

  it("gilt fehlende Summen als reparaturbedürftig", () => {
    const result = reconcileMealMacros({ stored: null, computed: sumIngredientTotals([rice]) });
    expect(result.corrected).toBe(true);
    expect(result.macros.kcal).toBe(540);
  });
});

describe("Portionen für zwei Personen", () => {
  const lukas = [rice, chicken];
  const nina = scaleIngredientsByFactor(lukas, 0.6);

  it("berechnet die Makros je Person aus genau deren Mengen", () => {
    const lukasTotals = sumIngredientTotals(lukas);
    const ninaTotals = sumIngredientTotals(nina);
    expect(ninaTotals.kcal).toBe(522);
    expect(ninaTotals.kcal).not.toBe(lukasTotals.kcal);
    expect(ninaTotals.protein_g).toBeCloseTo(47.7, 1);
  });

  it("zeigt Mengen je Person plus Gesamtmenge", () => {
    const lines = formatPartnerIngredientLines({
      selfName: "Lukas",
      otherName: "Nina",
      selfIngredients: lukas,
      otherIngredients: nina,
    });
    expect(lines[0]).toBe("Reis, trocken: 150 g für Lukas, 90 g für Nina — insgesamt 240 g");
    expect(lines[1]).toContain("300 g für Lukas, 180 g für Nina — insgesamt 480 g");
  });

  it("aggregiert die Einkaufsmenge erst aus den finalen Personenportionen", () => {
    expect(aggregateIngredientAmounts([lukas, nina])).toEqual([
      { name: "Reis, trocken", amount: 240, unit: "g" },
      { name: "Hähnchenbrust", amount: 480, unit: "g" },
    ]);
  });

  it("formatiert einzelne Zutatenzeilen lesbar", () => {
    expect(formatIngredientLine(chicken)).toBe("Hähnchenbrust: 300 g");
    expect(formatIngredientLine({ name: "Salz" })).toBe("Salz");
  });
});

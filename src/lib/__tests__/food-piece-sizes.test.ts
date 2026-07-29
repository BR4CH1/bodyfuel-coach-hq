import { describe, expect, it } from "vitest";

import { piecePresetFor, piecesToGrams } from "../food-piece-sizes";

describe("food piece sizes", () => {
  it("bietet Stück-Auswahl für Eier", () => {
    const preset = piecePresetFor({ name: "Ei (roh)", unit: "g" });
    expect(preset?.label).toBe("Stück");
    expect(piecesToGrams(2, preset!)).toBe(116);
  });

  it("nutzt Scheiben bei Toast", () => {
    expect(piecePresetFor({ name: "Toast Vollkorn", unit: "g" })?.label).toBe("Scheibe");
  });

  it("gibt für Flüssigkeiten und unbekannte Produkte keine Stückgröße", () => {
    expect(piecePresetFor({ name: "Milch 1,5%", unit: "ml" })).toBeNull();
    expect(piecePresetFor({ name: "Haferflocken", unit: "g" })).toBeNull();
  });

  it("bevorzugt gespeicherte Portionsgrößen", () => {
    expect(piecePresetFor({ name: "Ei", unit: "g", serving_g: 63 })?.grams).toBe(63);
  });
});

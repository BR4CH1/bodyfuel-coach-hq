import { describe, expect, it } from "vitest";

import {
  expandFoodQuery,
  isTypoMatch,
  normalizeFoodTerm,
  rankFoodResults,
  scoreFoodMatch,
  singularizeGermanToken,
} from "../food-search.logic";

const food = (
  name: string,
  overrides: Partial<{ brand: string | null; source: string }> = {},
) => ({
  name,
  brand: overrides.brand ?? null,
  source: overrides.source ?? "bodyfuel_verified",
});

describe("food search normalization", () => {
  it("normalisiert Umlaute, Bindestriche und Groß-/Kleinschreibung", () => {
    expect(normalizeFoodTerm("Hühner-Ei")).toBe("huehner ei");
    expect(normalizeFoodTerm("  KÖLLN Blütenzarte  ")).toBe("koelln bluetenzarte");
    expect(normalizeFoodTerm("Weißmehl")).toBe("weissmehl");
  });

  it("bildet Singularformen deutscher Pluralbegriffe", () => {
    expect(singularizeGermanToken("eier")).toContain("ei");
    expect(singularizeGermanToken("tomaten")).toContain("tomate");
  });

  it("toleriert einfache Tippfehler", () => {
    expect(isTypoMatch("haferflocken", "haferfloken")).toBe(true);
    expect(isTypoMatch("haferflocken", "kartoffeln")).toBe(false);
  });
});

describe("Eier-Suche", () => {
  it("expandiert Ei/Eier/Vollei in dieselbe Synonymgruppe", () => {
    for (const term of ["Ei", "Eier", "Vollei", "Hühnerei"]) {
      const variants = expandFoodQuery(term);
      expect(variants).toContain("ei");
      expect(variants).toContain("eier");
      expect(variants).toContain("vollei");
    }
  });

  it("kennt Spiegelei, Rührei, Eiklar und Eigelb", () => {
    expect(expandFoodQuery("Spiegelei")).toContain("spiegelei");
    expect(expandFoodQuery("Rührei")).toContain("ruehrei");
    expect(expandFoodQuery("Eiklar")).toContain("eiweiss");
    expect(expandFoodQuery("Eigelb")).toContain("eidotter");
  });

  it("rankt generische Eier-Treffer vor unpassenden Substring-Treffern", () => {
    const ranked = rankFoodResults(
      [
        food("Eisbergsalat (roh)"),
        food("Eiskaffee", { source: "manual" }),
        food("Ei (roh)"),
        food("Bio-Eier Freilandhaltung", { brand: "Marken GmbH", source: "open_food_facts" }),
      ],
      "Eier",
    );
    expect(ranked[0].name).toBe("Ei (roh)");
    expect(ranked.map((r) => r.name).indexOf("Eisbergsalat (roh)")).toBeGreaterThan(1);
  });
});

describe("Haferflocken-Suche", () => {
  it("findet Hafer-Synonyme", () => {
    const variants = expandFoodQuery("Haferflocken");
    expect(variants).toContain("hafer");
    expect(variants).toContain("oats");
  });

  it("stellt generische Haferflocken vor Markenprodukte", () => {
    const ranked = rankFoodResults(
      [
        food("Kölln Blütenzarte Haferflocken", {
          brand: "Kölln",
          source: "open_food_facts",
        }),
        food("Haferflocken (trocken)"),
        food("Haferflocken-Cheesecake", { source: "manual" }),
      ],
      "Haferflocken",
    );
    expect(ranked[0].name).toBe("Haferflocken (trocken)");
  });

  it("bewertet exakte Treffer höher als Teilstrings", () => {
    expect(scoreFoodMatch(food("Haferflocken"), "Haferflocken")).toBeGreaterThan(
      scoreFoodMatch(food("Haferflockenkeks"), "Haferflocken"),
    );
  });
});

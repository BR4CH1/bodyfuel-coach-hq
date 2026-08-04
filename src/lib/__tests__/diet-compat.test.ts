import { describe, expect, it } from "vitest";
import {
  classifyMealDiet,
  isDietClassCompatible,
  isMealCompatibleWithDiet,
  normalizeDietStyle,
} from "@/lib/diet-compat";

describe("normalizeDietStyle", () => {
  it("normalisiert deutsche und englische Werte", () => {
    expect(normalizeDietStyle("vegan")).toBe("vegan");
    expect(normalizeDietStyle("Vegetarisch")).toBe("vegetarian");
    expect(normalizeDietStyle("vegetarian")).toBe("vegetarian");
    expect(normalizeDietStyle("pescetarisch")).toBe("pescetarian");
    expect(normalizeDietStyle("pescatarian")).toBe("pescetarian");
    expect(normalizeDietStyle("omnivor")).toBe("omnivore");
    expect(normalizeDietStyle("flexitarian")).toBe("flexitarian");
    expect(normalizeDietStyle("other")).toBe("other");
    expect(normalizeDietStyle("")).toBeNull();
    expect(normalizeDietStyle(null)).toBeNull();
  });

  it("erkennt Freitext-Varianten", () => {
    expect(normalizeDietStyle("überwiegend vegetarisch")).toBe("vegetarian");
    expect(normalizeDietStyle("vegan (streng)")).toBe("vegan");
  });
});

describe("classifyMealDiet", () => {
  it("erkennt Fleisch, Fisch, Milch/Ei und pflanzlich", () => {
    expect(
      classifyMealDiet({ name: "Hähnchen-Reis-Bowl", ingredients: [{ name: "Hähnchenbrust" }] }),
    ).toBe("omnivore");
    expect(classifyMealDiet({ name: "Lachs mit Ofengemüse" })).toBe("pescetarian");
    expect(classifyMealDiet({ name: "Skyr mit Honig" })).toBe("vegetarian");
    expect(
      classifyMealDiet({
        name: "Chili sin Carne",
        tags: ["vegan"],
        ingredients: [{ name: "Kidneybohnen" }, { name: "Reis gekocht" }],
      }),
    ).toBe("vegan");
  });

  it("lässt Inhalt über Tags gewinnen", () => {
    expect(
      classifyMealDiet({ name: "Bowl", tags: ["vegan"], ingredients: [{ name: "Feta" }] }),
    ).toBe("vegetarian");
  });

  it("behandelt Pflanzendrinks nicht als Milchprodukt", () => {
    expect(
      classifyMealDiet({
        name: "Porridge mit Sojadrink",
        tags: ["vegan"],
        ingredients: [{ name: "Hafermilch" }, { name: "Sojajoghurt" }],
      }),
    ).toBe("vegan");
  });
});

describe("Kompatibilitätsmatrix", () => {
  it("überlappt korrekt nach oben", () => {
    expect(isDietClassCompatible("vegan", "vegan")).toBe(true);
    expect(isDietClassCompatible("vegan", "vegetarian")).toBe(true);
    expect(isDietClassCompatible("vegan", "pescetarian")).toBe(true);
    expect(isDietClassCompatible("vegan", "omnivore")).toBe(true);

    expect(isDietClassCompatible("vegetarian", "vegan")).toBe(false);
    expect(isDietClassCompatible("vegetarian", "vegetarian")).toBe(true);
    expect(isDietClassCompatible("vegetarian", "pescetarian")).toBe(true);

    expect(isDietClassCompatible("pescetarian", "vegetarian")).toBe(false);
    expect(isDietClassCompatible("pescetarian", "pescetarian")).toBe(true);

    expect(isDietClassCompatible("omnivore", "pescetarian")).toBe(false);
    expect(isDietClassCompatible("omnivore", "omnivore")).toBe(true);
  });

  it("schränkt omnivor, flexitarisch, other und unbekannt nicht ein", () => {
    for (const cls of ["vegan", "vegetarian", "pescetarian", "omnivore"] as const) {
      expect(isDietClassCompatible(cls, "omnivore")).toBe(true);
      expect(isDietClassCompatible(cls, "flexitarian")).toBe(true);
      expect(isDietClassCompatible(cls, "other")).toBe(true);
      expect(isDietClassCompatible(cls, null)).toBe(true);
    }
  });

  it("arbeitet auch mit rohen Profilwerten", () => {
    const lachs = { name: "Lachsfilet mit Kartoffeln" };
    expect(isMealCompatibleWithDiet(lachs, "pescetarisch")).toBe(true);
    expect(isMealCompatibleWithDiet(lachs, "vegetarisch")).toBe(false);
  });
});

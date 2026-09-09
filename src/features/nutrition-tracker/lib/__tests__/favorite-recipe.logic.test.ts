import { describe, expect, it } from "vitest";

import { parseFavoriteRecipeName } from "../favorite-recipe.logic";

describe("parseFavoriteRecipeName", () => {
  it("parses the legacy omelette favorite into every explicit ingredient amount", () => {
    const parsed = parseFavoriteRecipeName(
      "Frühstück: Omelett mit Käse und Vollkornbrot — 3 Eier, 40g Gouda (mittelalt, fettreduziert), 2 Scheiben Vollkornbrot (je 40g), 10g Butter zum Braten",
    );

    expect(parsed?.mealName).toBe("Frühstück: Omelett mit Käse und Vollkornbrot");
    expect(parsed?.ingredients).toEqual([
      { displayName: "Ei", searchName: "Ei", amount: 174, unit: "g" },
      {
        displayName: "Gouda (mittelalt, fettreduziert)",
        searchName: "Gouda mittelalt, fettreduziert",
        amount: 40,
        unit: "g",
      },
      {
        displayName: "Vollkornbrot",
        searchName: "Vollkornbrot",
        amount: 80,
        unit: "g",
      },
      {
        displayName: "Butter zum Braten",
        searchName: "Butter",
        amount: 10,
        unit: "g",
      },
    ]);
  });

  it("does not invent ingredients when the favorite has no explicit recipe", () => {
    expect(parseFavoriteRecipeName("Skyr Natur")).toBeNull();
    expect(parseFavoriteRecipeName("Bowl — nach Geschmack")).toBeNull();
  });

  it("keeps commas inside parentheses inside the ingredient name", () => {
    const parsed = parseFavoriteRecipeName(
      "Snack — 100g Quark (mager, natur), 20g Honig",
    );
    expect(parsed?.ingredients).toHaveLength(2);
    expect(parsed?.ingredients[0].displayName).toBe("Quark (mager, natur)");
  });
});

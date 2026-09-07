import { describe, expect, it } from "vitest";
import { normalizeShoppingListItems } from "@/lib/shopping-list-engine.server";

type InputItem = {
  name: string;
  quantity: string;
  category: string;
};

const item = (name: string, quantity: string): InputItem => ({
  name,
  quantity,
  category: "",
});

describe("shopping-list supermarket exactness", () => {
  it("keeps cheese varieties and purchase-relevant variants separate", () => {
    const result = normalizeShoppingListItems([
      item("Gouda Light gerieben", "600 g"),
      item("Mozzarella Light", "400 g"),
      item("Feta", "300 g"),
      item("Frischkäse Light", "200 g"),
      item("Parmesan", "100 g"),
      item("Hüttenkäse", "250 g"),
    ]);

    expect(result.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "Gouda Light gerieben",
        "Mozzarella Light",
        "Feta",
        "Frischkäse Light",
        "Parmesan",
        "Hüttenkäse",
      ]),
    );
    expect(result.some((entry) => entry.name === "Käse")).toBe(false);
  });

  it("never turns Rinderhack into Putenhack and keeps meat variants separate", () => {
    const result = normalizeShoppingListItems([
      item("Rinderhack 5 %", "500 g"),
      item("Putenhack", "400 g"),
      item("Hähnchenhack", "300 g"),
    ]);

    expect(result.find((entry) => entry.name === "Rinderhack 5 %")?.quantity).toBe("500 g");
    expect(result.find((entry) => entry.name === "Putenhack")?.quantity).toBe("400 g");
    expect(result.find((entry) => entry.name === "Hähnchenhack")?.quantity).toBe("300 g");
  });

  it("sums only truly identical products", () => {
    const result = normalizeShoppingListItems([
      item("Gouda Light gerieben", "300 g"),
      item("Gouda Light gerieben", "300 g"),
      item("Gouda", "200 g"),
    ]);

    expect(result.find((entry) => entry.name === "Gouda Light gerieben")?.quantity).toBe("600 g");
    expect(result.find((entry) => entry.name === "Gouda")?.quantity).toBe("200 g");
  });

  it("keeps nuts, seeds, rice and pasta varieties concrete", () => {
    const result = normalizeShoppingListItems([
      item("Mandeln", "100 g"),
      item("Walnüsse", "120 g"),
      item("Chia-Samen", "50 g"),
      item("Leinsamen", "60 g"),
      item("Basmati-Reis", "500 g"),
      item("Vollkornnudeln", "400 g"),
    ]);

    expect(result.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "Mandeln",
        "Walnüsse",
        "Chia-Samen",
        "Leinsamen",
        "Basmati-Reis",
        "Vollkornnudeln",
      ]),
    );
    expect(result.some((entry) => ["Nüsse", "Samen & Kerne", "Reis", "Nudeln"].includes(entry.name))).toBe(false);
  });
});

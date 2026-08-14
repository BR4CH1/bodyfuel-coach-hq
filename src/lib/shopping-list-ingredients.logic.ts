export type ShoppingMealIngredientSource = {
  recipe_ingredients?: unknown;
  ingredients_json?: unknown;
};

type StructuredIngredient = {
  name?: unknown;
  grams?: unknown;
  amount?: unknown;
  unit?: unknown;
};

/**
 * Normalizes both nutrition-plan ingredient storage formats into the textual
 * ingredient lines consumed by the shopping-list parser.
 *
 * AI/generated plans commonly use `recipe_ingredients: string[]`, while the
 * manual coach builder persists structured `ingredients_json` rows. Shopping
 * list generation must support both so manual and generated plans behave the
 * same way.
 */
export function shoppingIngredientLines(meal: ShoppingMealIngredientSource): string[] {
  const recipeIngredients = Array.isArray(meal.recipe_ingredients)
    ? meal.recipe_ingredients.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  if (recipeIngredients.length) return recipeIngredients;

  const structured = Array.isArray(meal.ingredients_json)
    ? (meal.ingredients_json as StructuredIngredient[])
    : [];

  return structured
    .map((ingredient) => {
      const name = String(ingredient?.name ?? "").trim();
      if (!name) return "";

      const grams = Number(ingredient?.grams);
      if (Number.isFinite(grams) && grams > 0) return `${grams} g ${name}`;

      const amount = Number(ingredient?.amount);
      if (Number.isFinite(amount) && amount > 0) {
        const unit = String(ingredient?.unit ?? "g").toLowerCase() === "ml" ? "ml" : "g";
        return `${amount} ${unit} ${name}`;
      }

      return name;
    })
    .filter(Boolean);
}

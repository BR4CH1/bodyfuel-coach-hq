export type MealImageIngredient = {
  name: string;
  amount_g?: number | null;
};

type MealImagePromptInput = {
  name: string;
  description?: string | null;
  ingredients: MealImageIngredient[];
};

const compact = (value: string, maxLength: number): string =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

export function buildMealImagePrompt({
  name,
  description,
  ingredients,
}: MealImagePromptInput): string {
  const mealName = compact(name, 120) || "fitness meal";
  const ingredientText = ingredients
    .slice(0, 16)
    .map((ingredient) => {
      const label = compact(ingredient.name, 80);
      if (!label) return "";
      const grams = Number(ingredient.amount_g);
      return Number.isFinite(grams) && grams > 0 ? `${Math.round(grams)} g ${label}` : label;
    })
    .filter(Boolean)
    .join(", ");
  const descriptionText = description ? compact(description, 500) : "";

  return [
    `Create one photorealistic premium food photograph for the meal "${mealName}".`,
    ingredientText
      ? `The plated meal must visibly match these ingredients: ${ingredientText}.`
      : "",
    descriptionText ? `Meal context: ${descriptionText}.` : "",
    "Show one realistic serving in a dark modern ceramic bowl or plate on a matte charcoal surface.",
    "Use soft natural studio light, a slightly elevated 45-degree camera angle, appetizing but realistic portions, and crisp food detail.",
    "Do not add ingredients that are not listed. No people, hands, packaging, logos, labels, text, watermarks, collages, or multiple dishes.",
    "Square composition with the full plate visible and enough clean margin for a rounded thumbnail crop.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function coerceMealImageIngredients(value: unknown): MealImageIngredient[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === "string") {
      const name = compact(item, 120);
      return name ? [{ name }] : [];
    }
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;
    const rawName = record.name ?? record.display_name ?? record.label;
    if (typeof rawName !== "string") return [];
    const name = compact(rawName, 120);
    if (!name) return [];

    const amount = Number(record.amount_g ?? record.grams);
    return [
      {
        name,
        amount_g: Number.isFinite(amount) && amount > 0 ? amount : null,
      },
    ];
  });
}

export function firstIngredientImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const url = (item as Record<string, unknown>).image_url;
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) return url.trim();
  }
  return null;
}

import { piecePresetFor } from "@/lib/food-piece-sizes";

export type FavoriteRecipeIngredientSpec = {
  displayName: string;
  searchName: string;
  amount: number;
  unit: "g" | "ml";
};

export type ParsedFavoriteRecipe = {
  mealName: string;
  ingredients: FavoriteRecipeIngredientSpec[];
};

function numberValue(value: string): number {
  return Number(value.replace(",", "."));
}

function splitIngredientList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function cleanSearchName(value: string): string {
  return value
    .replace(/\(\s*je\s+[0-9]+(?:[.,][0-9]+)?\s*(?:g|ml)\s*\)/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/\bzum\s+(?:an)?braten\b/gi, " ")
    .replace(/\bzur\s+zubereitung\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredient(part: string): FavoriteRecipeIngredientSpec | null {
  const mass = /^(\d+(?:[.,]\d+)?)\s*(g|ml)\s+(.+)$/i.exec(part);
  if (mass) {
    const amount = numberValue(mass[1]);
    if (!(amount > 0)) return null;
    const displayName = mass[3].trim();
    return {
      displayName,
      searchName: cleanSearchName(displayName),
      amount,
      unit: mass[2].toLowerCase() === "ml" ? "ml" : "g",
    };
  }

  const counted = /^(\d+(?:[.,]\d+)?)\s*(?:x\s*)?(stück|stueck|scheiben?|eier?|ei)\b\s*(.*)$/i.exec(part);
  if (counted) {
    const count = numberValue(counted[1]);
    if (!(count > 0)) return null;
    const token = counted[2].toLowerCase();
    const remainder = counted[3].trim();
    const displayName = remainder || (token.startsWith("ei") ? "Ei" : token);
    const explicitPerPiece = /\bje\s+(\d+(?:[.,]\d+)?)\s*g\b/i.exec(remainder);
    const searchName = cleanSearchName(displayName);
    const preset = piecePresetFor({ name: searchName, unit: "g", serving_g: null });
    const gramsPerPiece = explicitPerPiece ? numberValue(explicitPerPiece[1]) : preset?.grams;
    if (!(gramsPerPiece && gramsPerPiece > 0)) return null;
    return {
      displayName: cleanSearchName(displayName),
      searchName: token.startsWith("ei") && !remainder ? "Ei" : searchName,
      amount: count * gramsPerPiece,
      unit: "g",
    };
  }

  const inferredPiece = /^(\d+(?:[.,]\d+)?)\s+(.+)$/.exec(part);
  if (inferredPiece) {
    const count = numberValue(inferredPiece[1]);
    const displayName = inferredPiece[2].trim();
    const searchName = cleanSearchName(displayName);
    const preset = piecePresetFor({ name: searchName, unit: "g", serving_g: null });
    if (count > 0 && preset) {
      return {
        displayName,
        searchName,
        amount: count * preset.grams,
        unit: "g",
      };
    }
  }

  return null;
}

/**
 * Legacy AI/manual favorites stored only one flat FoodResult. If their name
 * still contains an explicit recipe after an em dash, recover only the
 * quantities that are stated unambiguously. We deliberately return null when
 * any ingredient cannot be parsed instead of inventing a composition.
 */
export function parseFavoriteRecipeName(value: string): ParsedFavoriteRecipe | null {
  const separatorIndex = value.lastIndexOf("—");
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) return null;

  const mealName = value.slice(0, separatorIndex).trim();
  const ingredientText = value.slice(separatorIndex + 1).trim();
  const rawParts = splitIngredientList(ingredientText);
  if (rawParts.length < 2) return null;

  const ingredients = rawParts.map(parseIngredient);
  if (ingredients.some((ingredient) => ingredient === null)) return null;

  return {
    mealName,
    ingredients: ingredients as FavoriteRecipeIngredientSpec[],
  };
}

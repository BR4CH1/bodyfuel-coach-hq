import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  buildMealImagePrompt,
  coerceMealImageIngredients,
  firstIngredientImageUrl,
  type MealImageIngredient,
} from "@/lib/meal-image.logic";

export type MealImageStatus = "none" | "pending" | "generating" | "ready" | "fallback" | "failed";

type MealImageTarget = "custom_meal" | "plan_meal";

type CustomMealImageRow = {
  id: string;
  user_id: string;
  name: string;
  ingredients: unknown;
  notes: string | null;
  image_url: string | null;
  image_status: MealImageStatus;
};

type PlanMealImageRow = {
  id: string;
  name: string;
  description: string | null;
  ingredients_json: unknown;
  recipe_ingredients: string[] | null;
  library_meal_id: string | null;
  image_url: string | null;
  image_status: MealImageStatus;
};

type ImageGatewayResponse = {
  data?: Array<{ b64_json?: string }>;
};

type MealImageSource = {
  id: string;
  name: string;
  description: string | null;
  ingredients: MealImageIngredient[];
  rawIngredients: unknown;
  imageUrl: string | null;
  imageStatus: MealImageStatus;
  libraryMealId: string | null;
  ownerPath: string;
};

const inputSchema = z.object({
  target: z.enum(["custom_meal", "plan_meal"]),
  meal_id: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

async function loadSource(
  target: MealImageTarget,
  mealId: string,
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<MealImageSource> {
  if (target === "custom_meal") {
    const { data, error } = await supabase
      .from("custom_meals")
      .select("id, user_id, name, ingredients, notes, image_url, image_status")
      .eq("id", mealId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Mahlzeit nicht gefunden");
    const row = data as CustomMealImageRow;
    return {
      id: row.id,
      name: row.name,
      description: row.notes,
      ingredients: coerceMealImageIngredients(row.ingredients),
      rawIngredients: row.ingredients,
      imageUrl: row.image_url,
      imageStatus: row.image_status,
      libraryMealId: null,
      ownerPath: userId,
    };
  }

  const { data, error } = await supabase
    .from("nutrition_plan_meals")
    .select(
      "id, name, description, ingredients_json, recipe_ingredients, library_meal_id, image_url, image_status",
    )
    .eq("id", mealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Plan-Mahlzeit nicht gefunden");
  const row = data as PlanMealImageRow;
  const ingredients = coerceMealImageIngredients(row.ingredients_json);
  const recipeIngredients = coerceMealImageIngredients(row.recipe_ingredients);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ingredients: ingredients.length ? ingredients : recipeIngredients,
    rawIngredients: row.ingredients_json,
    imageUrl: row.image_url,
    imageStatus: row.image_status,
    libraryMealId: row.library_meal_id,
    ownerPath: "plans",
  };
}

export const generateMealImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const source = await loadSource(data.target, data.meal_id, context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.force && source.imageUrl && source.imageStatus === "ready") {
      return { status: "cached" as const, image_url: source.imageUrl };
    }

    if (!data.force && data.target === "plan_meal" && source.libraryMealId) {
      const { data: libraryMeal } = await supabaseAdmin
        .from("coach_meal_library")
        .select("image_url, image_path, image_status, image_source, image_generated_at")
        .eq("id", source.libraryMealId)
        .maybeSingle();
      if (libraryMeal?.image_url && libraryMeal.image_status === "ready") {
        await supabaseAdmin
          .from("nutrition_plan_meals")
          .update({
            image_url: libraryMeal.image_url,
            image_path: libraryMeal.image_path,
            image_status: "ready",
            image_source: libraryMeal.image_source,
            image_generated_at: libraryMeal.image_generated_at,
          })
          .eq("id", source.id);
        return { status: "cached" as const, image_url: libraryMeal.image_url };
      }
    }

    const fallbackImage = firstIngredientImageUrl(source.rawIngredients);
    const table = data.target === "custom_meal" ? "custom_meals" : "nutrition_plan_meals";
    await supabaseAdmin.from(table).update({ image_status: "generating" }).eq("id", source.id);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      const preservedImage = fallbackImage ?? source.imageUrl;
      const fallbackPayload = preservedImage
        ? {
            image_url: preservedImage,
            image_status: fallbackImage ? "fallback" : "ready",
            image_source: fallbackImage ? "ingredient" : "ai_generated",
          }
        : { image_status: "failed", image_source: null };
      await supabaseAdmin.from(table).update(fallbackPayload).eq("id", source.id);
      return {
        status: fallbackImage
          ? ("fallback" as const)
          : preservedImage
            ? ("preserved" as const)
            : ("unavailable" as const),
        image_url: preservedImage,
        message: "Bildgenerierung ist noch nicht konfiguriert.",
      };
    }

    try {
      const prompt = buildMealImagePrompt({
        name: source.name,
        description: source.description,
        ingredients: source.ingredients,
      });
      const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
          modalities: ["image", "text"],
        }),
      });
      if (!response.ok) throw new Error(`Gateway ${response.status}`);

      const body = (await response.json()) as ImageGatewayResponse;
      const base64 = body.data?.[0]?.b64_json;
      if (!base64) throw new Error("Kein Bild empfangen");
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
        throw new Error("Ungültige Bildgröße");
      }

      const folder = data.target === "custom_meal" ? `custom/${source.ownerPath}` : "plans";
      const imagePath = `${folder}/${source.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("meal-images")
        .upload(imagePath, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("meal-images")
        .getPublicUrl(imagePath);
      const imageUrl = publicUrlData.publicUrl;
      const generatedAt = new Date().toISOString();
      const payload = {
        image_url: imageUrl,
        image_path: imagePath,
        image_status: "ready",
        image_source: "ai_generated",
        image_generated_at: generatedAt,
      };
      await supabaseAdmin.from(table).update(payload).eq("id", source.id);

      if (data.target === "custom_meal") {
        await supabaseAdmin.from("custom_meals").update({ image_error: null }).eq("id", source.id);
      }

      if (data.target === "plan_meal" && source.libraryMealId) {
        await supabaseAdmin
          .from("coach_meal_library")
          .update(payload)
          .eq("id", source.libraryMealId);
      }

      return { status: "generated" as const, image_url: imageUrl };
    } catch (error) {
      const preservedImage = fallbackImage ?? source.imageUrl;
      const fallbackPayload = preservedImage
        ? {
            image_url: preservedImage,
            image_status: fallbackImage ? "fallback" : "ready",
            image_source: fallbackImage ? "ingredient" : "ai_generated",
          }
        : { image_status: "failed", image_source: null };
      await supabaseAdmin.from(table).update(fallbackPayload).eq("id", source.id);
      if (data.target === "custom_meal") {
        await supabaseAdmin
          .from("custom_meals")
          .update({ image_error: error instanceof Error ? error.message.slice(0, 240) : "Fehler" })
          .eq("id", source.id);
      }
      return {
        status: fallbackImage
          ? ("fallback" as const)
          : preservedImage
            ? ("preserved" as const)
            : ("failed" as const),
        image_url: preservedImage,
        message: "Das Bild konnte gerade nicht erstellt werden.",
      };
    }
  });

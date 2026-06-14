// Server-only helper for generating shopping lists from a plan's meals.
// Imported by server functions, NOT by client code.
//
// IMPORTANT: Uses the admin client internally so partner plans work too.
// Callers are responsible for authorizing access before invoking these
// helpers (i.e. the calling server function has already checked the user
// owns / is coach for / is partner of the affected plans).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ShoppingItem = { name: string; quantity: string; category: string };

async function fetchMealLines(planId: string, windowDays: number): Promise<string[]> {
  const { data: days } = await supabaseAdmin
    .from("nutrition_plan_days")
    .select("id, sort_order")
    .eq("plan_id", planId)
    .order("sort_order");
  const dayIds = (days ?? []).slice(0, windowDays).map((d: any) => d.id);
  if (!dayIds.length) return [];
  const { data: meals } = await supabaseAdmin
    .from("nutrition_plan_meals")
    .select("name, description, recipe_ingredients")
    .in("day_id", dayIds);
  return (meals ?? []).map((m: any) => {
    const ing = (m.recipe_ingredients ?? []).join(", ");
    return `- ${m.name}${ing ? " | Zutaten: " + ing : m.description ? " | " + m.description : ""}`;
  });
}

async function callAi(prompt: string, apiKey: string): Promise<ShoppingItem[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status === 429) throw new Error("Rate-Limit erreicht");
  if (res.status === 402) throw new Error("KI-Guthaben aufgebraucht");
  if (!res.ok) throw new Error(`KI-Fehler [${res.status}]`);
  const raw = (await res.json())?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (parsed?.items as ShoppingItem[]) ?? [];
  } catch {
    return [];
  }
}

export async function generateShoppingListForPlan(opts: {
  /** Kept for API compatibility; engine uses the admin client internally. */
  supabase?: any;
  apiKey: string;
  planId: string;
  windowDays: number;
}): Promise<{ items: ShoppingItem[]; days: number }> {
  const { apiKey, planId, windowDays } = opts;

  const lines = await fetchMealLines(planId, windowDays);
  if (!lines.length) throw new Error("Plan enthält keine Mahlzeiten.");

  const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten EINE konsolidierte Einkaufsliste für ${windowDays} Tage.

WICHTIG — Mengen sauber zusammenfassen:
- Identische Zutaten in EINER Zeile mit summierter Menge (nie 3× "250 g Hähnchen", sondern "750 g Hähnchen").
- Einheiten vereinheitlichen (g, kg, ml, l, Stück).
- Kategorien: Obst & Gemüse, Fleisch & Fisch, Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Sonstiges.

MAHLZEITEN:
${lines.join("\n")}

Antworte ausschließlich mit gültigem JSON:
{"items":[{"name":"Hähnchenbrust","quantity":"1.4 kg","category":"Fleisch & Fisch"}]}`;

  const items = await callAi(prompt, apiKey);

  await supabaseAdmin
    .from("shopping_lists")
    .upsert(
      {
        plan_id: planId,
        scope: "individual",
        items,
        days: windowDays,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "plan_id,scope" },
    );

  return { items, days: windowDays };
}

/** Combined shopping list summing two partner plans. Stored on BOTH plans with scope='partner_combined'. */
export async function generateCombinedShoppingList(opts: {
  supabase?: any;
  apiKey: string;
  planAId: string;
  planBId: string;
  userA: string;
  userB: string;
  windowDays: number;
  /** Optional: nur diese Slots gelten als gemeinsam (z. B. nur "dinner"). */
  sharedSlots?: Array<"breakfast" | "lunch" | "dinner" | "snack">;
}): Promise<{ items: ShoppingItem[]; days: number }> {
  const { apiKey, planAId, planBId, userA, userB, windowDays } = opts;

  const [linesA, linesB] = await Promise.all([
    fetchMealLines(planAId, windowDays),
    fetchMealLines(planBId, windowDays),
  ]);
  if (!linesA.length && !linesB.length) throw new Error("Keine Mahlzeiten für die Partnerpläne.");

  const mealsText = [
    "# Person A (eigene Mahlzeiten):",
    ...linesA,
    "",
    "# Person B (eigene Mahlzeiten):",
    ...linesB,
  ].join("\n");

  const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten ZWEIER Partner eine EINZIGE gemeinsame Einkaufsliste für ${windowDays} Tage.

WICHTIG:
- Identische/ähnliche Zutaten beider Personen IN EINER Zeile zusammenfassen und Mengen ADDIEREN (z. B. 500 g + 900 g Hähnchen = 1.4 kg Hähnchenbrust).
- Gemeinsame Mahlzeiten (z. B. Abendessen) sind im Plan oft mit "Gemeinsam mit ..." markiert — Mengen so kalkulieren, dass beide Personen davon essen können (also für 2 Portionen, nicht doppelt).
- Einheiten vereinheitlichen (g, kg, ml, l, Stück).
- Kategorien: Obst & Gemüse, Fleisch & Fisch, Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Sonstiges.

MAHLZEITEN BEIDER PERSONEN:
${mealsText}

Antworte ausschließlich mit gültigem JSON:
{"items":[{"name":"Hähnchenbrust","quantity":"1.4 kg","category":"Fleisch & Fisch"}]}`;

  const items = await callAi(prompt, apiKey);

  const now = new Date().toISOString();
  await supabaseAdmin.from("shopping_lists").upsert(
    [
      { plan_id: planAId, scope: "partner_combined", partner_user_id: userB, items, days: windowDays, generated_at: now },
      { plan_id: planBId, scope: "partner_combined", partner_user_id: userA, items, days: windowDays, generated_at: now },
    ],
    { onConflict: "plan_id,scope" },
  );

  return { items, days: windowDays };
}

// Server-only helper for generating shopping lists from a plan's meals.
// Imported by server functions, NOT by client code.

type ShoppingItem = { name: string; quantity: string; category: string };

export async function generateShoppingListForPlan(opts: {
  supabase: any;
  apiKey: string;
  planId: string;
  windowDays: number;
}): Promise<{ items: ShoppingItem[]; days: number }> {
  const { supabase, apiKey, planId, windowDays } = opts;

  const { data: days } = await supabase
    .from("nutrition_plan_days")
    .select("id, name, sort_order")
    .eq("plan_id", planId)
    .order("sort_order");
  const dayIds = (days ?? []).slice(0, windowDays).map((d: any) => d.id);
  if (!dayIds.length) throw new Error("Plan enthält keine Tage.");

  const { data: meals } = await supabase
    .from("nutrition_plan_meals")
    .select("name, description, recipe_ingredients")
    .in("day_id", dayIds);

  const mealsText = (meals ?? [])
    .map((m: any) => {
      const ing = (m.recipe_ingredients ?? []).join(", ");
      return `- ${m.name}${ing ? " | Zutaten: " + ing : m.description ? " | " + m.description : ""}`;
    })
    .join("\n");

  const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten EINE konsolidierte Einkaufsliste für ${windowDays} Tage.

WICHTIG — Mengen sauber zusammenfassen:
- Identische Zutaten in EINER Zeile mit summierter Menge (nie 3× "250 g Hähnchen", sondern "750 g Hähnchen").
- Einheiten vereinheitlichen (g, kg, ml, l, Stück).
- Kategorien: Obst & Gemüse, Fleisch & Fisch, Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Sonstiges.

MAHLZEITEN:
${mealsText}

Antworte ausschließlich mit gültigem JSON:
{"items":[{"name":"Hähnchenbrust","quantity":"1.4 kg","category":"Fleisch & Fisch"}]}`;

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
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: ShoppingItem[] } = {};
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    parsed = {};
  }
  const items = parsed.items ?? [];

  await supabase
    .from("shopping_lists")
    .upsert(
      {
        plan_id: planId,
        items,
        days: windowDays,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "plan_id" },
    );

  return { items, days: windowDays };
}

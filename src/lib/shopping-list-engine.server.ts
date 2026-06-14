// Server-only helper for generating shopping lists from a plan's meals.
// Imported by server functions, NOT by client code.
//
// IMPORTANT: Uses the admin client internally so partner plans work too.
// Callers are responsible for authorizing access before invoking these
// helpers (i.e. the calling server function has already checked the user
// owns / is coach for / is partner of the affected plans).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ShoppingItem = { name: string; quantity: string; category: string };

function normalizeIngredientName(name: string) {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(ca\.|ungekocht|gekocht|light|fettarm|zuckerarm|magere)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryFor(name: string) {
  const n = name.toLowerCase();
  if (/hähnchen|pute|rind|hack|filet|fisch|lachs|thunfisch/.test(n)) return "Fleisch & Fisch";
  if (/skyr|quark|joghurt|käse|feta|whey|proteinpudding|eier?/.test(n)) return "Milchprodukte";
  if (/reis|nudel|kartoffel|brot|tortilla|hafer|müsli|reiswaffel|süßkartoffel/.test(n)) return "Getreide & Beilagen";
  if (/salat|gemüse|brokkoli|karotte|paprika|spargel|beeren|erdbeer|banane|apfel/.test(n)) return "Obst & Gemüse";
  if (/öl|butter|nuss|nüss|mandel|cashew|walnuss|erdnuss|kern|kokosmilch/.test(n)) return "Vorrat & Gewürze";
  return "Sonstiges";
}

function splitIngredientParts(text: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0 && !/\d/.test(text[i + 1] ?? "")) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function fallbackItemsFromLines(lines: string[]): ShoppingItem[] {
  const grouped = new Map<string, { amount: number; unit: string; name: string; category: string }>();
  for (const line of lines) {
    const partsText = line.includes(" | Zutaten: ")
      ? line.split(" | Zutaten: ")[1]
      : line.includes(" | ")
        ? line.split(" | ")[1]
        : "";
    for (const rawPart of splitIngredientParts(partsText)) {
      const part = rawPart.trim();
      if (!part) continue;
      const match = part.match(/^(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|scheiben|stück|stk\.?|eier|ei)?\s*(.*)$/i);
      const amount = match ? Number(match[1].replace(",", ".")) : 1;
      let unit = (match?.[2] ?? "Stück").replace(/^el$/i, "EL").replace(/^tl$/i, "TL").replace(/^stk\.?$/i, "Stück");
      let name = normalizeIngredientName(match ? (match[3] ?? "") : part);
      if (/^gemüse$/i.test(name)) name = part.includes("(") ? part.replace(/^\d+(?:[,.]\d+)?\s*(kg|g|ml|l)?\s*/i, "") : name;
      if (/^eier?$/i.test(unit) && !name) {
        name = "Eier";
        unit = "Stück";
      }
      if (!name) continue;
      const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
      const existing = grouped.get(key);
      if (existing) existing.amount += amount;
      else grouped.set(key, { amount, unit, name, category: categoryFor(name) });
    }
  }
  return Array.from(grouped.values()).map((item) => ({
    name: item.name,
    quantity: `${Number.isInteger(item.amount) ? item.amount : item.amount.toFixed(1).replace(".", ",")} ${item.unit}`,
    category: item.category,
  }));
}

function extractItems(parsed: any): ShoppingItem[] {
  const candidate = Array.isArray(parsed)
    ? parsed
    : parsed?.items ?? parsed?.shopping_list ?? parsed?.einkaufsliste ?? parsed?.list ?? [];
  return (Array.isArray(candidate) ? candidate : [])
    .map((item: any) => {
      let name = String(item?.name ?? item?.ingredient ?? item?.zutat ?? "").trim();
      let quantity = String(item?.quantity ?? item?.amount ?? item?.menge ?? "").trim();
      const egg = name.match(/^(\d+)\s+eier?$/i);
      if (egg) {
        name = "Eier";
        quantity = `${egg[1]} Stück`;
      }
      return { name, quantity, category: String(item?.category ?? item?.kategorie ?? categoryFor(name)).trim() || categoryFor(name) };
    })
    .filter((item) => item.name);
}

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
    .select("day_id, name, description, recipe_ingredients, sort_order")
    .in("day_id", dayIds)
    .order("sort_order");
  const dayOrder = new Map(dayIds.map((id, index) => [id, index]));
  return (meals ?? []).sort((a: any, b: any) => (dayOrder.get(a.day_id) ?? 0) - (dayOrder.get(b.day_id) ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((m: any) => {
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
    const clean = typeof raw === "string" ? raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim() : raw;
    const parsed = typeof clean === "string" ? JSON.parse(clean) : clean;
    return extractItems(parsed);
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

  const parsedItems = fallbackItemsFromLines(lines);
  const items = parsedItems.length ? parsedItems : await callAi(prompt, apiKey);

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

  const parsedItems = fallbackItemsFromLines([...linesA, ...linesB]);
  const items = parsedItems.length ? parsedItems : await callAi(prompt, apiKey);

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

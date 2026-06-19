// Server-only helper for generating shopping lists from a plan's meals.
// Imported by server functions, NOT by client code.
//
// IMPORTANT: Uses the admin client internally so partner plans work too.
// Callers are responsible for authorizing access before invoking these
// helpers (i.e. the calling server function has already checked the user
// owns / is coach for / is partner of the affected plans).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ShoppingItem = { name: string; quantity: string; category: string; checked?: boolean };

function normalizeIngredientName(name: string) {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(
      /\b(ca\.|ungekocht|gekocht|gegart|gebraten|gedünstet|roh|trocken|frisch|tiefgekühlt|tk|light|fettarm|zuckerarm|magere?r?|natur|pur|optional)\b/gi,
      "",
    )
    .replace(/\s+als\s+(dip|topping|beilage|snack|garnitur)\b.*/gi, "")
    .replace(/\s+(zum|zur|für|mit|nach\s+geschmack|nach\s+belieben)\b.*/gi, "")
    .replace(/^[-•·]\s*/, "")
    .replace(/:\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s: string) {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("de-DE") + s.slice(1);
}

/** Canonical key + display for merging duplicates ("Skyr"/"Skyr als Dip", "Reis (gekocht)"/"Reis"). */
function canonicalize(rawName: string): { key: string; display: string } {
  let n = normalizeIngredientName(rawName);
  n = n
    .replace(
      /^\d+(?:[,.]\d+)?\s*(stk\.?|stück|scheiben|el|tl|kg|g|ml|l|prise|hand\s*voll)?\s+/i,
      "",
    )
    .trim();
  n = n.replace(/^(eine?|ein|der|die|das|etwas|frische?r?|frisches?)\s+/i, "").trim();
  const lower = n.toLowerCase();
  const synonyms: Array<[RegExp, string]> = [
    [/^skyr\b.*/, "Skyr"],
    [/^reis\b.*/, "Reis"],
    [/^basmati(reis)?\b.*/, "Reis"],
    [/^jasmin(reis)?\b.*/, "Reis"],
    [/^(vollkorn)?nudeln?\b.*/, "Nudeln"],
    [/^spaghetti\b.*/, "Nudeln"],
    [/^penne\b.*/, "Nudeln"],
    [/^fusilli\b.*/, "Nudeln"],
    [/^kartoffeln?\b.*/, "Kartoffeln"],
    [/^süßkartoffeln?\b.*/, "Süßkartoffeln"],
    [/^suesskartoffeln?\b.*/, "Süßkartoffeln"],
    [/^haferflocken\b.*/, "Haferflocken"],
    [/^müsli\b.*/, "Müsli"],
    [/^muesli\b.*/, "Müsli"],
    [/^magerquark\b.*/, "Magerquark"],
    [/^(körniger\s+)?(frisch)?käse\b.*/, "Käse"],
    [/^hüttenkäse\b.*/, "Hüttenkäse"],
    [/^huettenkaese\b.*/, "Hüttenkäse"],
    [/^(griechischer\s+)?joghurt\b.*/, "Griechischer Joghurt"],
    [/^proteinpudding\b.*/, "Proteinpudding"],
    [/^protein(shake|pulver|riegel)?\b.*/, "Proteinpulver"],
    [/^whey\b.*/, "Proteinpulver"],
    [/^eier?\b.*/, "Eier"],
    [/^eiweiß\b.*/, "Eier"],
    [/^hähnchen(brust)?filet\b.*/, "Hähnchenbrust"],
    [/^haehnchen(brust)?filet\b.*/, "Hähnchenbrust"],
    [/^hähnchen(brust)?\b.*/, "Hähnchenbrust"],
    [/^haehnchen(brust)?\b.*/, "Hähnchenbrust"],
    [/^pute(nbrust|nfilet)?\b.*/, "Putenbrust"],
    [/^(rinder|puten|hähnchen)?hack(fleisch)?\b.*/, "Hackfleisch"],
    [/^lachs(filet)?\b.*/, "Lachs"],
    [/^thunfisch\b.*/, "Thunfisch"],
    [/^garnelen\b.*/, "Garnelen"],
    [/^vollkornbrot\b.*/, "Vollkornbrot"],
    [/^(eiweiß|protein)brot\b.*/, "Eiweißbrot"],
    [/^reiswaffeln?\b.*/, "Reiswaffeln"],
    [/^feta\b.*/, "Feta"],
    [/^mozzarella\b.*/, "Mozzarella"],
    [/^parmesan\b.*/, "Parmesan"],
    [/^butter\b.*/, "Butter"],
    [/^olivenöl\b.*/, "Olivenöl"],
    [/^oliven[öo]l\b.*/, "Olivenöl"],
    [/^rapsöl\b.*/, "Rapsöl"],
    [/^kokos[öo]l\b.*/, "Kokosöl"],
    [/^milch\b.*/, "Milch"],
    [/^hafermilch\b.*/, "Hafermilch"],
    [/^mandelmilch\b.*/, "Mandelmilch"],
    [/^bananen?\b.*/, "Bananen"],
    [/^[äa]pfel\b.*/, "Äpfel"],
    [/^heidelbeeren?\b.*/, "Heidelbeeren"],
    [/^erdbeeren?\b.*/, "Erdbeeren"],
    [/^himbeeren?\b.*/, "Himbeeren"],
    [/^beeren\b.*/, "Beeren"],
    [/^brokkoli\b.*/, "Brokkoli"],
    [/^blumenkohl\b.*/, "Blumenkohl"],
    [/^(karotten?|möhren?|moehren?)\b.*/, "Karotten"],
    [/^paprikapulver\b.*/, "Paprikapulver"],
    [/^paprikaschoten?\b.*/, "Paprika"],
    [/^paprika\b.*/, "Paprika"],
    [/^tomaten?\b.*/, "Tomaten"],
    [/^kirschtomaten?\b.*/, "Kirschtomaten"],
    [/^gurken?\b.*/, "Gurke"],
    [/^zwiebeln?\b.*/, "Zwiebeln"],
    [/^knoblauch\b.*/, "Knoblauch"],
    [/^spinat\b.*/, "Spinat"],
    [/^salat\b.*/, "Salat"],
    [/^avocados?\b.*/, "Avocado"],
    [/^zucchini\b.*/, "Zucchini"],
    [/^aubergine\b.*/, "Aubergine"],
    [/^mandeln?\b.*/, "Mandeln"],
    [/^walnüsse|^walnuesse|^walnuss\b.*/, "Walnüsse"],
    [/^cashews?\b.*/, "Cashews"],
    [/^erdnüsse|^erdnuesse|^erdnuss\b.*/, "Erdnüsse"],
    [/^(erdnuss|mandel)mus\b.*/, "Nussmus"],
    [/^honig\b.*/, "Honig"],
    [/^ahornsirup\b.*/, "Ahornsirup"],
    [/^tortillas?\b.*|^wraps?\b.*/, "Wraps"],
    [/^couscous\b.*/, "Couscous"],
    [/^quinoa\b.*/, "Quinoa"],
    [/^linsen\b.*/, "Linsen"],
    [/^kichererbsen\b.*/, "Kichererbsen"],
    [/^bohnen\b.*/, "Bohnen"],
    [/^pesto\b.*/, "Pesto"],
    [/^senf\b.*/, "Senf"],
    [/^ketchup\b.*/, "Ketchup"],
    [/^salz\b.*/, "Salz"],
    [/^pfeffer\b.*/, "Pfeffer"],
  ];
  for (const [re, label] of synonyms) {
    if (re.test(lower)) return { key: label.toLowerCase(), display: label };
  }
  return { key: lower, display: titleCase(n) };
}

function parseQuantity(q: string): { amount: number; unit: string } | null {
  const m = q.trim().match(/^(\d+(?:[,.]\d+)?)\s*(.*)$/);
  if (!m) return null;
  const amount = Number(m[1].replace(",", "."));
  let unit = (m[2] ?? "").trim();
  if (/^stk\.?$/i.test(unit)) unit = "Stück";
  if (/^eier?$/i.test(unit)) unit = "Stück";
  if (!unit) unit = "Stück";
  return { amount, unit };
}

function formatAmount(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(".", ",");
}

/** Merge items by canonical name; sum quantities where units are compatible. */
function mergeItems(items: ShoppingItem[]): ShoppingItem[] {
  const groups = new Map<
    string,
    {
      display: string;
      category: string;
      units: Map<string, number>;
      raws: string[];
      checked: boolean;
    }
  >();
  for (const source of items) {
    const inlineQuantity = source.name.match(
      /^(.+?):\s*(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|scheiben|stück|stk\.?)?$/i,
    );
    const it =
      inlineQuantity && (!source.quantity || /^1\s+stück$/i.test(source.quantity))
        ? {
            ...source,
            name: inlineQuantity[1],
            quantity: `${inlineQuantity[2]} ${inlineQuantity[3] ?? "g"}`,
          }
        : source;
    if (!it.name) continue;
    const { key, display } = canonicalize(it.name);
    const g = groups.get(key) ?? {
      display,
      category: it.category,
      units: new Map<string, number>(),
      raws: [] as string[],
      checked: false,
    };
    const parsed = parseQuantity(it.quantity);
    if (parsed) {
      let { amount, unit } = parsed;
      const ul = unit.toLowerCase();
      if (ul === "kg") {
        amount *= 1000;
        unit = "g";
      } else if (ul === "l") {
        amount *= 1000;
        unit = "ml";
      }
      g.units.set(unit, (g.units.get(unit) ?? 0) + amount);
    } else if (it.quantity) {
      g.raws.push(it.quantity);
    }
    if (it.checked) g.checked = true;
    if (!g.category || g.category === "Sonstiges") g.category = it.category || g.category;
    groups.set(key, g);
  }
  const out: ShoppingItem[] = [];
  for (const g of groups.values()) {
    const parts: string[] = [];
    for (const [unit, amount] of g.units.entries()) {
      let amt = amount;
      let u = unit;
      if (u === "g" && amt >= 1000) {
        amt = amt / 1000;
        u = "kg";
      } else if (u === "ml" && amt >= 1000) {
        amt = amt / 1000;
        u = "l";
      }
      parts.push(`${formatAmount(amt)} ${u}`);
    }
    parts.push(...g.raws);
    out.push({
      name: g.display,
      quantity: parts.join(" + "),
      category: g.category || categoryFor(g.display),
      checked: g.checked || undefined,
    });
  }
  const catOrder = [
    "Obst & Gemüse",
    "Fleisch & Fisch",
    "Milchprodukte",
    "Getreide & Beilagen",
    "Vorrat & Gewürze",
    "Sonstiges",
  ];
  out.sort((a, b) => {
    const ca = catOrder.indexOf(a.category);
    const cb = catOrder.indexOf(b.category);
    const ra = ca === -1 ? 99 : ca;
    const rb = cb === -1 ? 99 : cb;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "de");
  });
  return out;
}

export function cleanShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return mergeItems(items);
}

function categoryFor(name: string) {
  const n = name.toLowerCase();
  if (/hähnchen|pute|rind|hack|filet|fisch|lachs|thunfisch/.test(n)) return "Fleisch & Fisch";
  if (/skyr|quark|joghurt|käse|feta|whey|proteinpudding|eier?/.test(n)) return "Milchprodukte";
  if (/reis|nudel|kartoffel|brot|tortilla|hafer|müsli|reiswaffel|süßkartoffel/.test(n)) return "Getreide & Beilagen";
  if (/paprikapulver|öl|butter|nuss|nüss|mandel|cashew|walnuss|erdnuss|kern|kokosmilch/.test(n)) return "Vorrat & Gewürze";
  if (/salat|gemüse|brokkoli|karotte|paprika|spargel|beeren|erdbeer|banane|apfel/.test(n)) return "Obst & Gemüse";
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
  const grouped = new Map<
    string,
    { amount: number; unit: string; name: string; category: string }
  >();
  for (const line of lines) {
    const partsText = line.includes(" | Zutaten: ")
      ? line.split(" | Zutaten: ")[1]
      : line.includes(" | ")
        ? line.split(" | ")[1]
        : "";
    for (const rawPart of splitIngredientParts(partsText)) {
      const part = rawPart.trim();
      if (!part) continue;
      const inlineQuantity = part.match(
        /^(.+?):\s*(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|scheiben|stück|stk\.?|eier|ei)?$/i,
      );
      const normalizedPart = inlineQuantity
        ? `${inlineQuantity[2]} ${inlineQuantity[3] ?? ""} ${inlineQuantity[1]}`
        : part;
      const match = normalizedPart.match(
        /^(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|scheiben|stück|stk\.?|eier|ei)?\s*(.*)$/i,
      );
      const amount = match ? Number(match[1].replace(",", ".")) : 1;
      let unit = (match?.[2] ?? "Stück")
        .replace(/^el$/i, "EL")
        .replace(/^tl$/i, "TL")
        .replace(/^stk\.?$/i, "Stück");
      let name = normalizeIngredientName(match ? (match[3] ?? "") : normalizedPart);
      if (/^gemüse$/i.test(name)) {
        name = part.includes("(")
          ? part.replace(/^\d+(?:[,.]\d+)?\s*(kg|g|ml|l)?\s*/i, "")
          : name;
      }
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
  const items = mergeItems(parsedItems.length ? parsedItems : await callAi(prompt, apiKey));

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
  const items = mergeItems(parsedItems.length ? parsedItems : await callAi(prompt, apiKey));

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

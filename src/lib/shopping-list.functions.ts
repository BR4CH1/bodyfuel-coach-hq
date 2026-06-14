import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

type ShoppingItem = {
  name: string;
  quantity: string;
  category: string;
};

async function generateForPlan(opts: {
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

Antworte ausschließlich mit gültigem JSON in dieser Form:
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
  if (res.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
  if (res.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
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

  // Cache it
  await supabase
    .from("shopping_lists")
    .upsert(
      { plan_id: planId, items, days: windowDays, generated_at: new Date().toISOString() },
      { onConflict: "plan_id" },
    );

  return { items, days: windowDays };
}

/**
 * Generate (and cache) a shopping list for the user's currently active plan.
 * If `plan_id` is passed, generates for that plan instead.
 * Honors a `force` flag to bypass cache.
 */
export const generateShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number; plan_id?: string; force?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    // Resolve plan
    let planId = data.plan_id;
    if (!planId) {
      const { data: plan } = await supabase
        .from("nutrition_plans")
        .select("id")
        .eq("client_id", userId)
        .eq("plan_type", "nutrition")
        .eq("status", "active")
        .maybeSingle();
      if (!plan) throw new Error("Kein aktiver Ernährungsplan gefunden.");
      planId = (plan as any).id;
    }

    // Determine window
    let windowDays = data.days;
    if (!windowDays) {
      const { data: prof } = await supabase
        .from("smart_nutrition_profile")
        .select("shopping_days")
        .eq("user_id", userId)
        .maybeSingle();
      windowDays = daysUntilNextShopping((prof as any)?.shopping_days);
    }

    // Try cache (skip if force or windowDays explicit)
    if (!data.force && !data.days) {
      const { data: cached } = await supabase
        .from("shopping_lists")
        .select("items, days, generated_at")
        .eq("plan_id", planId)
        .maybeSingle();
      if (cached && (cached as any).items?.length) {
        return {
          items: (cached as any).items as ShoppingItem[],
          days: (cached as any).days as number,
          cached: true,
        };
      }
    }

    return await generateForPlan({ supabase, apiKey, planId: planId as string, windowDays });
  });

/**
 * Returns active & next plan summary plus their cached shopping lists.
 * Used by the customer "Aktuelle vs Nächste" toggle.
 */
export const getMyShoppingLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("smart_nutrition_profile")
      .select("shopping_days")
      .eq("user_id", userId)
      .maybeSingle();
    const window = daysUntilNextShopping((prof as any)?.shopping_days);

    const { data: plans } = await supabase
      .from("nutrition_plans")
      .select(
        "id, title, status, scheduled_start_date, scheduled_end_date",
      )
      .eq("client_id", userId)
      .eq("plan_type", "nutrition")
      .in("status", ["active", "draft", "approved", "published"])
      .order("created_at", { ascending: false });

    const all = (plans ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ?? null;

    const ids = [active?.id, next?.id].filter(Boolean) as string[];
    let lists: Record<string, { items: ShoppingItem[]; days: number; generated_at: string }> = {};
    if (ids.length) {
      const { data: rows } = await supabase
        .from("shopping_lists")
        .select("plan_id, items, days, generated_at")
        .in("plan_id", ids);
      lists = Object.fromEntries(
        (rows ?? []).map((r: any) => [
          r.plan_id,
          { items: r.items ?? [], days: r.days ?? 7, generated_at: r.generated_at },
        ]),
      );
    }

    return {
      active: active
        ? { ...active, list: lists[active.id] ?? null }
        : null,
      next: next
        ? { ...next, list: lists[next.id] ?? null }
        : null,
      window_days: window,
    };
  });

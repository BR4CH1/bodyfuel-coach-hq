import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ShoppingItem = {
  name: string;
  quantity: string;
  category: string;
};

export const generateShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    // Load active plan
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("client_id", userId)
      .eq("plan_type", "nutrition")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!plan) throw new Error("Kein aktiver Ernährungsplan gefunden.");

    const { data: days } = await supabase
      .from("nutrition_plan_days")
      .select("id, day_label, sort_order")
      .eq("plan_id", plan.id)
      .order("sort_order");
    const dayIds = (days ?? []).slice(0, data.days ?? 7).map((d) => d.id);
    if (!dayIds.length) throw new Error("Plan enthält keine Tage.");

    const { data: meals } = await supabase
      .from("nutrition_plan_meals")
      .select("name, description, recipe_ingredients")
      .in("day_id", dayIds);

    const mealsText = (meals ?? [])
      .map((m) => {
        const ing = (m.recipe_ingredients ?? []).join(", ");
        return `- ${m.name}${ing ? " | Zutaten: " + ing : m.description ? " | " + m.description : ""}`;
      })
      .join("\n");

    const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten EINE konsolidierte Einkaufsliste für ${data.days ?? 7} Tage. Fasse identische Zutaten zusammen und summiere Mengen sinnvoll. Gruppiere nach Kategorie (Obst & Gemüse, Fleisch & Fisch, Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Sonstiges).

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
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }
    return { items: parsed.items ?? [] };
  });

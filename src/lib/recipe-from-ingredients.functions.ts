import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateRecipeFromIngredients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredients: string; goal?: string }) => {
    if (!d.ingredients?.trim()) throw new Error("Bitte Zutaten angeben.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { data: targets } = await supabase
      .from("nutrition_targets")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .maybeSingle();

    const prompt = `Du bist Ernährungsberater. Erstelle aus den folgenden Zutaten EIN passendes Rezept für eine ausgewogene Mahlzeit.

ZUTATEN DES KUNDEN: ${data.ingredients}
${data.goal ? "ZIEL: " + data.goal : ""}
${targets ? `TAGES-ZIELE (Orientierung): ${targets.kcal} kcal · ${targets.protein_g}P/${targets.carbs_g}C/${targets.fat_g}F g` : ""}

Antworte ausschließlich mit gültigem JSON in dieser Form:
{"name":"Hähnchen-Reis-Bowl","description":"Kurze Beschreibung","kcal":650,"protein_g":45,"carbs_g":70,"fat_g":18,"servings":1,"ingredients":["200g Hähnchen","80g Reis"],"steps":["Reis kochen","Hähnchen würzen und braten"]}`;

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
    let parsed: any = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }
    return parsed;
  });

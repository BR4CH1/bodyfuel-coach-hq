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

    const [{ data: targets }, { data: profile }] = await Promise.all([
      supabase
        .from("nutrition_targets")
        .select("kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("smart_nutrition_profile")
        .select("nogo_foods, allergies, extra_nogos, extra_allergies, meal_prep_style")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const p: any = profile ?? {};
    const allergyList = [
      ...(p.allergies ?? []),
      ...((p.extra_allergies ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const nogoList = [
      ...(p.nogo_foods ?? []),
      ...((p.extra_nogos ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
    ];
    const prepHint =
      p.meal_prep_style === "low_effort" ? "Halte das Rezept einfach und schnell (max 15 Min)." :
      p.meal_prep_style === "meal_prep" ? "Soll meal-prep-tauglich sein." : "";

    const prompt = `Du bist Ernährungsberater. Erstelle aus den folgenden Zutaten EIN passendes Rezept für eine ausgewogene Mahlzeit.

ZUTATEN DES KUNDEN: ${data.ingredients}
${data.goal ? "ZIEL: " + data.goal : ""}
${targets ? `TAGES-ZIELE (Orientierung): ${targets.kcal} kcal · ${targets.protein_g}P/${targets.carbs_g}C/${targets.fat_g}F g` : ""}

🚨 ABSOLUTE AUSSCHLÜSSE (höchste Priorität, NIEMALS verwenden!):
${allergyList.length ? "ALLERGIEN/UNVERTRÄGLICHKEITEN: " + allergyList.join(", ") : "(keine)"}
${nogoList.length ? "NO-GO LEBENSMITTEL: " + nogoList.join(", ") : "(keine)"}
${prepHint}

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
    if (res.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
    if (!res.ok) throw new Error(`Fehler [${res.status}]`);
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }

    return parsed;
  });

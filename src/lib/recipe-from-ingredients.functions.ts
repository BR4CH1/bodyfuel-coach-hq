import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RecipeGenerationContext = {
  allergies?: string[];
  noGos?: string[];
  mealPrepStyle?: string | null;
  targets?: {
    kcal?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
  } | null;
};

export const generateRecipeFromIngredients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ingredients: string;
      goal?: string;
      /**
       * Builder-Modus: Lebensmittel und Mengen sind verbindlich. Die KI darf
       * daraus nur Gerichtname, Beschreibung und Zubereitung ableiten.
       */
      fixedQuantities?: boolean;
      /**
       * Optionaler, bereits serverseitig geladener Kundenkontext aus dem
       * Ernährungsplan-Builder. Fehlt er, gilt wie bisher das eigene Profil.
       */
      recipeContext?: RecipeGenerationContext;
    }) => {
      if (!d.ingredients?.trim()) throw new Error("Bitte Zutaten angeben.");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    let targets: any = data.recipeContext?.targets ?? null;
    let allergyList = (data.recipeContext?.allergies ?? []).map((s) => String(s).trim()).filter(Boolean);
    let nogoList = (data.recipeContext?.noGos ?? []).map((s) => String(s).trim()).filter(Boolean);
    let mealPrepStyle = data.recipeContext?.mealPrepStyle ?? null;

    // Bestehender Self-Service-Weg bleibt unverändert: wenn kein externer
    // Builder-Kontext mitgegeben wurde, laden wir Profil und Ziele des Users.
    if (!data.recipeContext) {
      const [{ data: ownTargets }, { data: profile }] = await Promise.all([
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

      targets = ownTargets;
      const p: any = profile ?? {};
      allergyList = [
        ...(p.allergies ?? []),
        ...((p.extra_allergies ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
      ];
      nogoList = [
        ...(p.nogo_foods ?? []),
        ...((p.extra_nogos ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)),
      ];
      mealPrepStyle = p.meal_prep_style ?? null;
    }

    const prepHint =
      mealPrepStyle === "low_effort"
        ? "Halte das Rezept einfach und schnell (max 15 Min)."
        : mealPrepStyle === "meal_prep"
          ? "Soll meal-prep-tauglich sein."
          : "";

    const fixedQuantityRule = data.fixedQuantities
      ? `\nVERBINDLICHE BUILDER-REGELN:\n- Verwende ALLE vorgegebenen Lebensmittel exakt in den angegebenen Mengen.\n- Keine Zutat entfernen, ersetzen oder in der Menge verändern.\n- Keine zusätzlichen kalorienhaltigen Lebensmittel, Öle oder Saucen ergänzen.\n- Wasser sowie kalorienfreie Gewürze/Kräuter dürfen nur für die Zubereitung erwähnt werden.\n- Die vorgegebenen Zutaten und Mengen sind die einzige Quelle für die später berechneten Nährwerte.\n- Erzeuge vor allem einen sinnvollen Gerichtnamen, eine kurze Beschreibung und praktikable Zubereitungsschritte.\n`
      : "";

    const prompt = `Du bist Ernährungsberater. Erstelle aus den folgenden Zutaten EIN passendes Rezept für eine ausgewogene Mahlzeit.

ZUTATEN DES KUNDEN: ${data.ingredients}
${data.goal ? "ZIEL: " + data.goal : ""}
${targets ? `TAGES-/MAHLZEIT-ZIELE (Orientierung): ${targets.kcal ?? "-"} kcal · ${targets.protein_g ?? "-"}P/${targets.carbs_g ?? "-"}C/${targets.fat_g ?? "-"}F g` : ""}
${fixedQuantityRule}
Berücksichtige wenn möglich:
${allergyList.length ? "ALLERGIEN/UNVERTRÄGLICHKEITEN: " + allergyList.join(", ") : ""}
${nogoList.length ? "NO-GO LEBENSMITTEL: " + nogoList.join(", ") : ""}
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
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = {};
    }

    return parsed;
  });
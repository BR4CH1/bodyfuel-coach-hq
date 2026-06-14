import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ParsedMeal = {
  name: string;
  description?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};
type ParsedDay = { name: string; meals: ParsedMeal[] };

export const parseNutritionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");

    const { data: plan, error: pErr } = await supabase
      .from("nutrition_plans")
      .select("id, file_path, plan_type, client_id")
      .eq("id", data.plan_id)
      .single();
    if (pErr || !plan) throw new Error(pErr?.message || "Plan nicht gefunden");
    if (plan.plan_type !== "nutrition") throw new Error("Kein Ernährungsplan");

    const { data: tgt } = await supabase
      .from("nutrition_targets")
      .select("kcal, kcal_rest")
      .eq("user_id", plan.client_id)
      .maybeSingle();
    const targetTraining = tgt?.kcal ?? null;
    const targetRest = tgt?.kcal_rest ?? tgt?.kcal ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("nutrition-plans")
      .download(plan.file_path);
    if (dlErr || !file) throw new Error(dlErr?.message || "Download fehlgeschlagen");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    const targetLine = targetTraining
      ? `Zielwerte des Kunden: Trainingstag ≈ ${targetTraining} kcal${targetRest && targetRest !== targetTraining ? `, Restday ≈ ${targetRest} kcal` : ""}.`
      : `Keine Zielwerte hinterlegt — orientiere dich an den im Plan angegebenen kcal.`;

    const prompt = `Du bekommst einen Ernährungsplan als PDF.
Extrahiere ALLE Tage und je Tag ALLE Mahlzeiten.

WICHTIG zur Tag-Aufteilung:
- Jede Trainingstag-Variante ist ein EIGENER Tag (z.B. "Trainingstag A/B/C" → drei Tage mit genau diesen Namen).
- "Restday" / "Ruhetag" / "Pause" ist ein eigener Tag.
- Wochentage oder "Tag 1/2/3" sind je ein eigener Tag.
- Mahlzeiten gehören NUR zu dem Tag, unter dem sie im Plan stehen. Nicht duplizieren.

WICHTIG zu den Mahlzeit-Namen — verwende AUSSCHLIESSLICH diese sprechenden Namen, NIEMALS "Mahlzeit 1/2/3":
- 1 Mahlzeit: Frühstück
- 2: Frühstück, Abendessen
- 3: Frühstück, Mittag, Abendessen
- 4: Frühstück, Mittag, Snack, Abendessen
- 5: Frühstück, Snack, Mittag, Snack, Abendessen
- 6: Frühstück, Snack, Mittag, Snack, Abendessen, Spätsnack
- 7+: Frühstück, Snack, Mittag, Snack, Abendessen, Snack, Spätsnack …
Reihenfolge nach Tageszeit. Klar erkennbare Sonderfälle ("Pre-Workout", "Post-Workout", "Shake") darfst du als Namen behalten.
Schreibe NIE den Tag-Namen in den Mahlzeit-Namen.

KALORIEN-CHECK:
${targetLine}
Wenn die Summe der kcal eines Tages das jeweilige Ziel um mehr als 200 kcal überschreitet, lasse einen Snack (bevorzugt den kleinsten) WEG, damit die Summe näher am Ziel liegt. Hauptmahlzeiten (Frühstück, Mittag, Abendessen) NIE weglassen.

Beschreibung: eine Zeile, NUR Lebensmittel komma-getrennt mit Mengen. KEINE Zubereitungsanweisungen.
kcal/Protein/Kohlenhydrate/Fett: ganze Zahlen wenn angegeben, sonst null.

Antworte ausschließlich mit gültigem JSON:
{ "days": [ { "name": "Trainingstag A", "meals": [ { "name": "Frühstück", "description": "250g Skyr, 1 Banane, 30g Haferflocken", "kcal": 420, "protein_g": 35, "carbs_g": 55, "fat_g": 6 } ] } ] }`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "file",
                file: {
                  filename: "plan.pdf",
                  file_data: `data:application/pdf;base64,${b64}`,
                },
              },
            ],
          },
        ],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: { days?: ParsedDay[] };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden");
    }
    const days = Array.isArray(parsed.days) ? parsed.days : [];
    if (!days.length) throw new Error("Keine Mahlzeiten erkannt");

    await supabaseAdmin.from("nutrition_plan_days").delete().eq("plan_id", plan.id);

    const nz = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };

    let totalMeals = 0;
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const { data: dayRow, error: dayErr } = await supabaseAdmin
        .from("nutrition_plan_days")
        .insert({
          plan_id: plan.id,
          name: String(d.name ?? `Tag ${di + 1}`).slice(0, 120),
          sort_order: di,
        })
        .select()
        .single();
      if (dayErr || !dayRow) throw new Error(dayErr?.message || "Insert fehlgeschlagen");
      const meals = Array.isArray(d.meals) ? d.meals : [];
      const rows = meals
        .map((m, i) => ({
          day_id: dayRow.id,
          name: String(m.name ?? "").slice(0, 200),
          description: m.description ? String(m.description).slice(0, 1000) : null,
          kcal: nz(m.kcal),
          protein_g: nz(m.protein_g),
          carbs_g: nz(m.carbs_g),
          fat_g: nz(m.fat_g),
          sort_order: i,
        }))
        .filter((r) => r.name);
      totalMeals += rows.length;
      if (rows.length) {
        const { error: mErr } = await supabaseAdmin.from("nutrition_plan_meals").insert(rows);
        if (mErr) throw new Error(mErr.message);
      }
    }
    return { days: days.length, meals: totalMeals };
  });

export const estimateMealMacros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { meal_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { data: meal, error: mErr } = await supabase
      .from("nutrition_plan_meals")
      .select("id, name, description, kcal, protein_g, carbs_g, fat_g, day_id")
      .eq("id", data.meal_id)
      .maybeSingle();
    if (mErr || !meal) throw new Error(mErr?.message || "Mahlzeit nicht gefunden");

    const { data: dayRow } = await supabase
      .from("nutrition_plan_days")
      .select("plan_id, nutrition_plans!inner(client_id)")
      .eq("id", meal.day_id)
      .maybeSingle();
    const clientId = (dayRow as any)?.nutrition_plans?.client_id;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (clientId !== userId && !isCoach) throw new Error("Forbidden");

    const text = `${meal.name}${meal.description ? " — " + meal.description : ""}`;
    const prompt = `Schätze die Nährwerte für diese Mahlzeit so realistisch wie möglich auf Basis üblicher Lebensmitteldatenbanken (DGE / USDA).
Mahlzeit: ${text}
Antworte ausschließlich mit gültigem JSON in dieser Form (ganzzahlige Werte, keine Einheiten):
{"kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let est: any = {};
    try { est = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { est = {}; }
    const nz = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    };
    const out = {
      kcal: nz(est.kcal),
      protein_g: nz(est.protein_g),
      carbs_g: nz(est.carbs_g),
      fat_g: nz(est.fat_g),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("nutrition_plan_meals").update(out).eq("id", meal.id);

    return out;
  });

export const generateMealRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { meal_id: string; force?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: meal, error: mErr } = await supabase
      .from("nutrition_plan_meals")
      .select(
        "id, name, description, kcal, protein_g, carbs_g, fat_g, day_id, recipe_ingredients, recipe_steps, recipe_generated_at",
      )
      .eq("id", data.meal_id)
      .maybeSingle();
    if (mErr || !meal) throw new Error(mErr?.message || "Mahlzeit nicht gefunden");

    // Authorization: meal must belong to the caller's plan, or caller is coach
    const { data: dayRow } = await supabase
      .from("nutrition_plan_days")
      .select("plan_id, nutrition_plans!inner(client_id)")
      .eq("id", meal.day_id)
      .maybeSingle();
    const clientId = (dayRow as any)?.nutrition_plans?.client_id;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (clientId !== userId && !isCoach) throw new Error("Forbidden");

    // Cache hit
    if (!data.force && Array.isArray(meal.recipe_ingredients) && meal.recipe_ingredients.length > 0) {
      return {
        ingredients: meal.recipe_ingredients as string[],
        steps: (meal.recipe_steps as string[]) ?? [],
        cached: true,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const macros = [
      meal.kcal != null ? `${meal.kcal} kcal` : null,
      meal.protein_g != null ? `${meal.protein_g}g Eiweiß` : null,
      meal.carbs_g != null ? `${meal.carbs_g}g Kohlenhydrate` : null,
      meal.fat_g != null ? `${meal.fat_g}g Fett` : null,
    ].filter(Boolean).join(", ");

    const prompt = `Du bist Ernährungsberater. Erstelle ein einfaches, alltagstaugliches Rezept für genau EINE Person für die folgende Mahlzeit.

Mahlzeit: ${meal.name}${meal.description ? ` — ${meal.description}` : ""}
${macros ? `Zielwerte (möglichst treffen): ${macros}` : ""}

Anforderungen:
- Zutaten mit konkreten Mengen in Gramm/ml/Stück, so dass die Zielwerte ungefähr passen.
- Wenn in der Beschreibung schon Lebensmittel + Mengen stehen, nutze GENAU diese.
- 3 bis 6 kurze Zubereitungsschritte, jeder Schritt 1 Satz.
- Auf Deutsch.

Antworte ausschließlich mit gültigem JSON in diesem Format:
{"ingredients": ["250 g Magerquark", "1 Banane (ca. 120 g)", "30 g Haferflocken"], "steps": ["Quark in eine Schüssel geben.", "Banane zerdrücken und unterheben."]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
    if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte im Workspace aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { ingredients?: unknown; steps?: unknown } = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }

    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
      : [];
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    if (!ingredients.length) throw new Error("Rezept konnte nicht erstellt werden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("nutrition_plan_meals")
      .update({
        recipe_ingredients: ingredients,
        recipe_steps: steps,
        recipe_generated_at: new Date().toISOString(),
      })
      .eq("id", meal.id);

    return { ingredients, steps, cached: false };
  });

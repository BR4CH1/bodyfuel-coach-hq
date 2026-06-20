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

Beschreibung: eine Zeile, NUR Lebensmittel komma-getrennt mit Mengen. KEINE Zubereitungsanweisungen. JEDE Zutat braucht eine konkrete Menge in g, ml, Stück oder EL/TL — auch Salat, Gemüse, Beilagen und Toppings IMMER in Gramm (z. B. "150g Blattsalat", "200g Brokkoli"). NIE "Portion", "etwas" oder "nach Geschmack".
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
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: { days?: ParsedDay[] };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Antwort konnte nicht gelesen werden");
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
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
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
        "id, name, description, kcal, protein_g, carbs_g, fat_g, day_id, partner_meal_id, recipe_ingredients, recipe_steps, recipe_generated_at",
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

    // Detect partner meal even if partner_meal_id is missing — look for the
    // shared-meal prefix we set in partner-nutrition-plan-ai.functions.ts.
    const nameLooksShared = /Gemeinsam mit\s+(.+?)\s+—/i.exec(meal.name || "");
    const partnerNameFromTitle = nameLooksShared?.[1]?.trim() || null;
    const isPartnerMeal = !!meal.partner_meal_id || !!partnerNameFromTitle;

    // Partner-meal lookup: fetch the partner's macros + display name so the
    // recipe can list per-person quantities. We do this BEFORE the cache check
    // so cached recipes with stale "für Person" labels can be fixed on the fly.
    type Partner = { name: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; description?: string | null };
    let selfPartner: Partner | null = null;
    let otherPartner: Partner | null = null;
    if (meal.partner_meal_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pMeal } = await supabaseAdmin
        .from("nutrition_plan_meals")
        .select("kcal, protein_g, carbs_g, fat_g, day_id, description")
        .eq("id", meal.partner_meal_id)
        .maybeSingle();
      if (pMeal) {
        const { data: pDay } = await supabaseAdmin
          .from("nutrition_plan_days")
          .select("nutrition_plans!inner(client_id)")
          .eq("id", (pMeal as any).day_id)
          .maybeSingle();
        const otherClientId = (pDay as any)?.nutrition_plans?.client_id;
        if (clientId && otherClientId) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("id, display_name, first_name, email")
            .in("id", [clientId, otherClientId]);
          const nameOf = (id: string, fallback: string) => {
            const p: any = (profs ?? []).find((x: any) => x.id === id);
            return (
              p?.display_name?.trim() ||
              p?.first_name?.trim() ||
              (p?.email ? p.email.split("@")[0] : null) ||
              fallback
            );
          };
          // Prefer the name embedded in the meal title (set by the partner-plan
          // generator from the partner's display_name) over a profile lookup
          // that may return a stale/empty value for one side.
          const otherName = partnerNameFromTitle || nameOf(otherClientId, "Partner");
          const selfName = nameOf(clientId, "Ich");
          selfPartner = {
            name: selfName,
            kcal: meal.kcal, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g,
            description: meal.description,
          };
          otherPartner = {
            name: otherName,
            kcal: (pMeal as any).kcal, protein_g: (pMeal as any).protein_g,
            carbs_g: (pMeal as any).carbs_g, fat_g: (pMeal as any).fat_g,
            description: (pMeal as any).description ?? null,
          };
        }
      }
    }

    const fixLabels = (arr: string[]) => {
      if (!selfPartner || !otherPartner) return arr;
      // Replace generic "für Person" AND duplicate "für Du, für Du" patterns
      // that older cached recipes contain when both profiles had no name.
      const patterns = [/\bfür\s+Person\b/gi, /\bfür\s+Du\b/g];
      return arr.map((s) => {
        let out = s;
        for (const re of patterns) {
          if (!re.test(out)) continue;
          let first = true;
          out = out.replace(re, () => {
            const name = first ? selfPartner!.name : otherPartner!.name;
            first = false;
            return `für ${name}`;
          });
        }
        return out;
      });
    };

    // Cache hit — regenerate when the cached recipe is missing partner names,
    // still uses generic "Person"/"Du" placeholders, or doesn't mention the
    // current partner's actual name.
    const cached = Array.isArray(meal.recipe_ingredients) ? (meal.recipe_ingredients as string[]) : [];
    const joined = cached.join("\n");
    const hasPerPerson = /\bfür\s+\S/i.test(joined);
    const hasPlaceholder = /\bfür\s+(Person|Du)\b/i.test(joined);
    const otherInText = otherPartner?.name && joined.toLowerCase().includes(otherPartner.name.toLowerCase());
    const skipCache = isPartnerMeal && (!hasPerPerson || hasPlaceholder || !otherInText);
    if (!data.force && !skipCache && cached.length > 0) {
      return {
        ingredients: fixLabels(cached),
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

    const partnerBlock = selfPartner && otherPartner
      ? `
WICHTIG — Das ist eine PARTNER-MAHLZEIT, die zwei Personen GEMEINSAM kochen:
- ${selfPartner.name}: Zielwerte: ${[selfPartner.kcal && `${selfPartner.kcal} kcal`, selfPartner.protein_g && `${selfPartner.protein_g}g Eiweiß`, selfPartner.carbs_g && `${selfPartner.carbs_g}g KH`, selfPartner.fat_g && `${selfPartner.fat_g}g Fett`].filter(Boolean).join(", ")}${selfPartner.description ? `\n  Portion laut Plan: ${selfPartner.description}` : ""}
- ${otherPartner.name}: Zielwerte: ${[otherPartner.kcal && `${otherPartner.kcal} kcal`, otherPartner.protein_g && `${otherPartner.protein_g}g Eiweiß`, otherPartner.carbs_g && `${otherPartner.carbs_g}g KH`, otherPartner.fat_g && `${otherPartner.fat_g}g Fett`].filter(Boolean).join(", ")}${otherPartner.description ? `\n  Portion laut Plan: ${otherPartner.description}` : ""}

PFLICHT-FORMAT für JEDE Zutat (genau so, ohne Ausnahme):
"<Lebensmittel>: <Menge> für ${selfPartner.name}, <Menge> für ${otherPartner.name} — insgesamt <Summe>"

Beispiele:
- "Rinderhackfleisch: 200 g für ${selfPartner.name}, 100 g für ${otherPartner.name} — insgesamt 300 g"
- "Reis (ungekocht): 150 g für ${selfPartner.name}, 80 g für ${otherPartner.name} — insgesamt 230 g"
- Bei Gewürzen / Öl, das geteilt wird: "Rapsöl: 1 EL für ${selfPartner.name}, 0,5 EL für ${otherPartner.name} — insgesamt 1,5 EL"

Skaliere die Mengen pro Person passend zu den jeweiligen Makro-Zielen (${otherPartner.name} hat oft weniger kcal, also kleinere Portionen). Wenn in den Portion-Angaben oben schon Mengen pro Person stehen, übernimm GENAU diese und addiere die Summe.

NIEMALS eine Zutat ohne "für ${selfPartner.name}" und "für ${otherPartner.name}" schreiben. NIEMALS nur die Gesamtmenge ohne Aufteilung schreiben. NIEMALS "für Person" oder generische Platzhalter statt der echten Namen verwenden.

Zubereitungsschritte: gemeinsame Zubereitung in einem Topf/Pfanne, am Ende auf zwei Teller portionieren (in den passenden Mengen).`
      : "";

    const onePersonBlock = !partnerBlock
      ? `Erstelle das Rezept für genau EINE Person.
- Zutaten mit konkreten Mengen in Gramm/ml/Stück, so dass die Zielwerte ungefähr passen.
- Wenn in der Beschreibung schon Lebensmittel + Mengen stehen, nutze GENAU diese.`
      : "";

    const prompt = `Du bist Ernährungsberater. Erstelle ein einfaches, alltagstaugliches Rezept für die folgende Mahlzeit.

Mahlzeit: ${meal.name}${meal.description ? ` — ${meal.description}` : ""}
${!partnerBlock && macros ? `Zielwerte: ${macros}` : ""}
${partnerBlock}
${onePersonBlock}

Anforderungen:
- 3 bis 6 kurze Zubereitungsschritte, jeder Schritt 1 Satz.
- Auf Deutsch.

Antworte ausschließlich mit gültigem JSON in diesem Format:
{"ingredients": ["..."], "steps": ["..."]}`;

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
    if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht — bitte im Workspace aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { ingredients?: unknown; steps?: unknown } = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }

    let ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
      : [];
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    if (!ingredients.length) throw new Error("Rezept konnte nicht erstellt werden");

    ingredients = fixLabels(ingredients);

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

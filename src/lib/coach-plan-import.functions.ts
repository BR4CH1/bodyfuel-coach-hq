import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImportedPlan } from "@/lib/customer-training-plan.functions";

/**
 * Coach-Plan-Import:
 * - Trainingsplan & Ernährungsplan für einen ausgewählten Kunden importieren.
 * - Eingabe: PDF / Bild / Text / manuelles JSON.
 * - Wird IMMER als Entwurf (status='draft', is_active=false) gespeichert,
 *   damit der Coach denselben Freigabe-Flow wie bei KI-Plänen hat.
 */

// ───────────────────────── Shared helpers ─────────────────────────

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { data: isCoach } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Nur für Coaches.");
}

async function callGateway(messages: any[]): Promise<any> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      max_tokens: 16000,
      messages,
    }),
  });
  if (res.status === 429) throw new Error("Rate-Limit erreicht — gleich nochmal versuchen.");
  if (res.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`KI-Fehler [${res.status}]: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Antwort konnte nicht gelesen werden.");
  }
}

function buildMessages(
  systemPrompt: string,
  mode: "text" | "image" | "pdf",
  payload: string,
  filename?: string,
  userText?: string,
): any[] {
  if (mode === "text") {
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: (userText ?? "") + "\n\n" + payload.slice(0, 24000) },
    ];
  }
  if (mode === "image") {
    return [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText ?? "Extrahiere als JSON wie spezifiziert." },
          { type: "image_url", image_url: { url: payload } },
        ],
      },
    ];
  }
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: userText ?? "Extrahiere als JSON wie spezifiziert." },
        {
          type: "file",
          file: {
            filename: filename || "plan.pdf",
            file_data: payload,
          },
        },
      ],
    },
  ];
}

// ───────────────────────── TRAINING ─────────────────────────

const CATEGORIES = new Set([
  "barbell", "dumbbell", "machine", "cardio", "core", "bodyweight", "cable",
]);

function normalizeTrainingPlan(input: any): ImportedPlan {
  const raw: any = input ?? {};
  let days: any[] = [];
  if (Array.isArray(raw.days)) days = raw.days;
  else if (Array.isArray(raw.weeks)) {
    for (const w of raw.weeks) {
      for (const d of w?.days ?? []) {
        days.push({ ...d, week_number: w?.week_number ?? d?.week_number ?? 1 });
      }
    }
  }
  const cleaned = days.map((d) => ({
    name: String(d?.name ?? "Trainingstag").slice(0, 120),
    focus: d?.focus ? String(d.focus).slice(0, 120) : null,
    week_number: Number.isFinite(Number(d?.week_number)) ? Math.max(1, Math.min(12, Number(d.week_number))) : 1,
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).map((e: any) => ({
      name: String(e?.name ?? "").slice(0, 200),
      category: e?.category && CATEGORIES.has(String(e.category)) ? String(e.category) : null,
      target_sets: Number.isFinite(Number(e?.target_sets))
        ? Math.max(1, Math.min(20, Math.round(Number(e.target_sets)))) : null,
      target_reps: e?.target_reps ? String(e.target_reps).slice(0, 80) : null,
      target_weights: e?.target_weights ? String(e.target_weights).slice(0, 120) : null,
      rest_seconds: Number.isFinite(Number(e?.rest_seconds))
        ? Math.max(15, Math.min(600, Math.round(Number(e.rest_seconds)))) : null,
      notes: e?.notes ? String(e.notes).slice(0, 500) : null,
    })).filter((e: any) => e.name),
  })).filter((d: any) => d.exercises.length || d.name);

  const weeks_count = Math.max(1, Math.min(12,
    Number(raw.weeks_count) || cleaned.reduce((m: number, d: any) => Math.max(m, d.week_number ?? 1), 1),
  ));
  return {
    title: raw.title ? String(raw.title).slice(0, 160) : undefined,
    weeks_count,
    days: cleaned,
  };
}

/**
 * Speichert einen vom Coach importierten Trainingsplan als Draft für den Kunden.
 * Vorherige draft/approved/published Pläne werden archiviert.
 */
export const saveCoachTrainingPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string; plan: ImportedPlan; title?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const plan = normalizeTrainingPlan(data.plan);
    if (!plan.days.length) throw new Error("Plan enthält keine Tage.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const weeks = plan.weeks_count ?? 1;
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + weeks * 7 - 1);

    // Archive existing non-active plans (matches AI flow)
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ status: "archived" } as any)
      .eq("client_id", data.client_id)
      .eq("plan_type", "training")
      .in("status", ["draft", "approved", "published"]);

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("nutrition_plans")
      .insert({
        client_id: data.client_id,
        title: data.title?.trim() || plan.title?.trim() ||
          `Coach-Trainingsplan — ${today.toLocaleDateString("de-DE")}`,
        plan_type: "training",
        is_active: false,
        status: "draft",
        source: "manual",
        generated_by: "coach",
        uploaded_by: context.userId,
        file_path: `ai-generated/${data.client_id}/coach-training-${Date.now()}.json`,
        file_name: "coach-training.json",
        scheduled_start_date: start,
        scheduled_end_date: endDate.toISOString().slice(0, 10),
        weeks_count: weeks,
      } as any)
      .select("id").single();
    if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

    let totalEx = 0;
    let dayIdx = 0;
    for (const d of plan.days) {
      const { data: dayRow, error: dayErr } = await supabaseAdmin
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: d.focus ? `${d.name} — ${d.focus}` : d.name,
          sort_order: dayIdx++,
          week_number: d.week_number ?? 1,
        } as any)
        .select("id").single();
      if (dayErr || !dayRow) continue;

      const rows = d.exercises.map((e: any, idx: number) => ({
        day_id: dayRow.id,
        name: e.name,
        category: e.category ?? null,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weights: e.target_weights,
        rest_seconds: e.rest_seconds,
        notes: e.notes,
        sort_order: idx,
      }));
      if (rows.length) {
        const { error: exErr } = await supabaseAdmin
          .from("training_exercises").insert(rows as any);
        if (!exErr) totalEx += rows.length;
      }
    }

    if (totalEx === 0) {
      await supabaseAdmin.from("nutrition_plans").delete().eq("id", planRow.id);
      throw new Error("Keine Übungen erkannt.");
    }

    return { ok: true, plan_id: planRow.id, days: plan.days.length, exercises: totalEx };
  });

// ───────────────────────── NUTRITION ─────────────────────────

export type ImportedNutritionIngredient = { name: string; grams?: number | null; amount?: number | null; unit?: string | null };
export type ImportedNutritionMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description?: string | null;
  ingredients: ImportedNutritionIngredient[];
};
export type ImportedNutritionDay = {
  name: string;
  type?: "training" | "rest";
  meals: ImportedNutritionMeal[];
};
export type ImportedNutritionPlan = {
  title?: string;
  days: ImportedNutritionDay[];
};

const NUTRITION_SYSTEM_PROMPT = `Du bist ein Assistent, der bestehende Ernährungspläne in strukturiertes JSON umwandelt.
Antworte AUSSCHLIESSLICH mit gültigem JSON in dieser Form:
{
  "title": "Plan-Titel",
  "days": [
    {
      "name": "Tag 1",
      "type": "training",
      "meals": [
        {
          "slot": "breakfast",
          "name": "Haferflocken mit Apfel",
          "description": "Optionale Zubereitungsnotiz",
          "ingredients": [
            { "name": "Haferflocken", "grams": 80 },
            { "name": "Apfel", "grams": 150 },
            { "name": "Magermilch", "grams": 200 }
          ]
        }
      ]
    }
  ]
}
Regeln:
- slot: einer von "breakfast" | "lunch" | "dinner" | "snack"
- type: "training" oder "rest" (falls erkennbar, sonst weglassen)
- Jede Zutat MUSS einen "name" und eine Mengenangabe haben — bevorzugt "grams" (Zahl in Gramm). Wenn keine Gramm-Angabe ableitbar ist, gib "amount" + "unit" an (z.B. "amount": 1, "unit": "Stück") — der Server rechnet das in Gramm um.
- Keine Nährwerte angeben — die werden serverseitig aus der Datenbank berechnet.
- Keine Erklärungen außerhalb des JSON.`;

function normalizeNutritionPlan(input: any): ImportedNutritionPlan {
  const raw: any = input ?? {};
  const days = Array.isArray(raw.days) ? raw.days : [];
  const cleaned: ImportedNutritionDay[] = days.map((d: any, i: number) => {
    const meals = Array.isArray(d?.meals) ? d.meals : [];
    return {
      name: String(d?.name ?? `Tag ${i + 1}`).slice(0, 80),
      type: d?.type === "training" || d?.type === "rest" ? d.type : undefined,
      meals: meals.map((m: any): ImportedNutritionMeal => {
        const slotRaw = String(m?.slot ?? "snack").toLowerCase();
        const slot: ImportedNutritionMeal["slot"] =
          slotRaw === "breakfast" || slotRaw === "lunch" || slotRaw === "dinner"
            ? slotRaw : "snack";
        const ings = Array.isArray(m?.ingredients) ? m.ingredients : [];
        return {
          slot,
          name: String(m?.name ?? "Mahlzeit").slice(0, 200),
          description: m?.description ? String(m.description).slice(0, 500) : null,
          ingredients: ings.map((ing: any) => ({
            name: String(ing?.name ?? "").slice(0, 120),
            grams: Number.isFinite(Number(ing?.grams)) ? Number(ing.grams) : null,
            amount: Number.isFinite(Number(ing?.amount)) ? Number(ing.amount) : null,
            unit: ing?.unit ? String(ing.unit).slice(0, 24) : null,
          })).filter((x: any) => x.name),
        };
      }).filter((m: any) => m.name),
    };
  }).filter((d: any) => d.meals.length);

  return {
    title: raw.title ? String(raw.title).slice(0, 160) : undefined,
    days: cleaned,
  };
}

/**
 * Parst einen Ernährungsplan (PDF / Bild / Text) in strukturiertes JSON.
 * Nutzt KI nur zur Struktur-Extraktion — Nährwerte werden später vom Server berechnet.
 */
export const parseCoachNutritionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: "text" | "image" | "pdf"; payload: string; filename?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    if (!data.payload || data.payload.length < 10) throw new Error("Kein Inhalt zum Parsen.");
    const userText =
      data.mode === "text"
        ? "Wandle den folgenden Ernährungsplan in das geforderte JSON-Format um:"
        : "Extrahiere den Ernährungsplan aus dieser Datei als JSON wie spezifiziert.";
    const messages = buildMessages(NUTRITION_SYSTEM_PROMPT, data.mode, data.payload, data.filename, userText);
    const parsed = await callGateway(messages);
    return normalizeNutritionPlan(parsed);
  });

/** Sehr grobe Standard-Umrechnung amount+unit → grams, wenn AI keine Gramm liefert. */
function approxGramsFromUnit(name: string, amount: number, unit: string): number {
  const u = unit.toLowerCase().trim();
  if (u === "g" || u === "gramm") return amount;
  if (u === "kg") return amount * 1000;
  if (u === "ml" || u === "milliliter") return amount; // Wasser-Dichte als Näherung
  if (u === "l" || u === "liter") return amount * 1000;
  if (u === "tl" || u === "teelöffel") return amount * 5;
  if (u === "el" || u === "esslöffel") return amount * 15;
  if (u === "stück" || u === "stk" || u === "stk.") {
    const n = name.toLowerCase();
    if (/apfel|birne|orange/.test(n)) return amount * 150;
    if (/banane/.test(n)) return amount * 120;
    if (/ei|eier/.test(n)) return amount * 60;
    if (/scheibe|toast|brot/.test(n)) return amount * 30;
    return amount * 80;
  }
  if (u === "tasse" || u === "cup") return amount * 240;
  if (u === "prise") return 1;
  return amount;
}

/**
 * Speichert einen vom Coach importierten Ernährungsplan als Draft für den Kunden.
 * - Rechnet Nährwerte über die Nutrition-Engine aus den Zutaten.
 * - Archiviert vorherige draft/approved/published Ernährungspläne.
 */
export const saveCoachNutritionPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string; plan: ImportedNutritionPlan; title?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const plan = normalizeNutritionPlan(data.plan);
    if (!plan.days.length) throw new Error("Plan enthält keine Tage.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeMealFromIngredients } = await import("./nutrition-engine.server");

    type ComputedMeal = {
      slot: ImportedNutritionMeal["slot"];
      name: string;
      description: string | null;
      ingredients: ImportedNutritionIngredient[];
      kcal: number; protein_g: number; carbs_g: number; fat_g: number;
      data_source: string;
      verified_ratio: number;
      warnings: string[];
    };

    // Pre-compute all meals through the engine
    const computedDays: { name: string; meals: ComputedMeal[] }[] = [];
    let dailySum = { kcal: 0, p: 0, c: 0, f: 0 };
    let dayCount = 0;
    for (const d of plan.days) {
      const meals: ComputedMeal[] = [];
      let daySum = { kcal: 0, p: 0, c: 0, f: 0 };
      for (const m of d.meals) {
        const engineIngs = m.ingredients.map((ing) => {
          let grams = Number(ing.grams ?? 0);
          if (!grams && ing.amount && ing.unit) {
            grams = approxGramsFromUnit(ing.name, Number(ing.amount), String(ing.unit));
          }
          return { name: ing.name, grams: Math.max(0, Math.round(grams)) };
        });
        const result = await computeMealFromIngredients(supabaseAdmin, engineIngs);
        meals.push({
          slot: m.slot,
          name: m.name,
          description: m.description ?? null,
          ingredients: m.ingredients,
          kcal: Math.round(result.kcal),
          protein_g: Math.round(result.protein_g),
          carbs_g: Math.round(result.carbs_g),
          fat_g: Math.round(result.fat_g),
          data_source: result.data_source ?? "db_verified",
          verified_ratio: result.verified_ratio ?? 1,
          warnings: result.warnings ?? [],
        });
        daySum.kcal += result.kcal;
        daySum.p += result.protein_g;
        daySum.c += result.carbs_g;
        daySum.f += result.fat_g;
      }
      computedDays.push({ name: d.name, meals });
      dailySum.kcal += daySum.kcal;
      dailySum.p += daySum.p;
      dailySum.c += daySum.c;
      dailySum.f += daySum.f;
      dayCount += 1;
    }

    const avgKcal = Math.round((dailySum.kcal / Math.max(1, dayCount)) / 50) * 50;
    const avgP = Math.round(dailySum.p / Math.max(1, dayCount));
    const avgC = Math.round(dailySum.c / Math.max(1, dayCount));
    const avgF = Math.round(dailySum.f / Math.max(1, dayCount));

    // Archive existing non-active nutrition plans
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ status: "archived" } as any)
      .eq("client_id", data.client_id)
      .eq("plan_type", "nutrition")
      .in("status", ["draft", "approved", "published"]);

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today);
    end.setDate(end.getDate() + computedDays.length - 1);

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("nutrition_plans")
      .insert({
        client_id: data.client_id,
        title: data.title?.trim() || plan.title?.trim() ||
          `Coach-Ernährungsplan — ${today.toLocaleDateString("de-DE")}`,
        plan_type: "nutrition",
        is_active: false,
        status: "draft",
        source: "manual",
        generated_by: "coach",
        uploaded_by: context.userId,
        file_path: `ai-generated/${data.client_id}/coach-nutrition-${Date.now()}.json`,
        file_name: "coach-nutrition.json",
        scheduled_start_date: start,
        scheduled_end_date: end.toISOString().slice(0, 10),
        kcal: avgKcal,
        protein_g: avgP,
        carbs_g: avgC,
        fat_g: avgF,
      } as any)
      .select("id").single();
    if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

    let totalMeals = 0;
    for (let i = 0; i < computedDays.length; i++) {
      const d = computedDays[i];
      const { data: dayRow, error: dErr } = await supabaseAdmin
        .from("nutrition_plan_days")
        .insert({ plan_id: planRow.id, name: d.name, sort_order: i } as any)
        .select("id").single();
      if (dErr || !dayRow) continue;

      let snackCounter = 0;
      const mealRows = d.meals.map((m, idx) => {
        let slotLabel: string;
        if (m.slot === "breakfast") slotLabel = "Frühstück";
        else if (m.slot === "lunch") slotLabel = "Mittagessen";
        else if (m.slot === "dinner") slotLabel = "Abendessen";
        else { snackCounter += 1; slotLabel = `Snack ${snackCounter}`; }
        return {
          day_id: dayRow.id,
          name: `${d.name} — ${slotLabel}: ${m.name}`,
          description: m.description ?? null,
          ingredients_json: m.ingredients.length ? m.ingredients.map((ing) => ({
            name: ing.name,
            grams: Number(ing.grams ?? 0) || null,
            amount: ing.amount ?? null,
            unit: ing.unit ?? null,
          })) : null,
          compute_warnings: m.warnings,
          kcal: m.kcal,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          sort_order: idx,
          data_source: m.data_source,
          verified_ratio: m.verified_ratio,
        };
      });
      if (mealRows.length) {
        const { error: mErr } = await supabaseAdmin
          .from("nutrition_plan_meals").insert(mealRows as any);
        if (!mErr) totalMeals += mealRows.length;
      }
    }

    if (totalMeals === 0) {
      await supabaseAdmin.from("nutrition_plans").delete().eq("id", planRow.id);
      throw new Error("Keine Mahlzeiten erkannt.");
    }

    // Optional: shopping list für draft
    try {
      const { generateShoppingListForPlan } = await import("./shopping-list-engine.server");
      await generateShoppingListForPlan(supabaseAdmin, planRow.id);
    } catch {
      // non-fatal
    }

    return { ok: true, plan_id: planRow.id, days: computedDays.length, meals: totalMeals };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";
import type { FoodAmountUnit } from "@/lib/food-units";
import { checkFoodEnergy } from "@/lib/food-energy";
import {
  expandFoodQuery,
  normalizeFoodTerm,
  rankFoodResults,
  foodSourcePriority,
} from "@/lib/food-search.logic";


export type FoodSource =
  | "bls_4_0"
  | "bodyfuel_verified"
  | "open_food_facts"
  | "usda"
  | "ai_estimate"
  | "barcode"
  | "manual"
  | null;

export type FoodResult = {
  id?: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  /** Eingabe- und Referenzeinheit: Flüssigkeiten ml, alle anderen Lebensmittel g. */
  unit: FoodAmountUnit;
  /** Nur für Flüssigkeiten; dient der Legacy-Massenablage, nicht der Makro-Skalierung. */
  density_g_per_ml: number | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  salt_per_100g?: number | null;
  sodium_mg_per_100g?: number | null;
  /** Gramm pro Stück/Portion (z.B. 1 Scheibe Toast = 25g), falls bekannt */
  serving_g: number | null;
  /** Roh-Label von OFF, z.B. "1 slice (25g)" oder "30 g" */
  serving_label: string | null;
  /** Datenquelle (bls_4_0, bodyfuel_verified, open_food_facts, usda, ai_estimate, …) */
  source?: FoodSource;
  /** True wenn Coach geprüft */
  verified_by_coach?: boolean;
  image_url?: string | null;
  image_source?: string | null;
};

function mapNutritionFoodRow(r: any): FoodResult {
  const unit: FoodAmountUnit = r.unit_type === "ml" ? "ml" : "g";
  const source = r.source as FoodSource;
  return {
    id: r.id ?? null,
    name: r.name,
    brand: r.brand ?? (source === "open_food_facts" ? (r.source_name ?? null) : null),
    barcode: r.barcode ?? (source === "open_food_facts" ? (r.source_id ?? null) : null),
    unit,
    density_g_per_ml:
      unit === "ml" && Number(r.density_g_per_ml) > 0 ? Number(r.density_g_per_ml) : null,
    kcal_per_100g: Number(r.kcal_per_100g) || 0,
    protein_per_100g: Number(r.protein_per_100g) || 0,
    carbs_per_100g: Number(r.carbs_per_100g) || 0,
    fat_per_100g: Number(r.fat_per_100g) || 0,
    fiber_per_100g: r.fiber_per_100g == null ? null : Number(r.fiber_per_100g),
    sugar_per_100g: r.sugar_per_100g == null ? null : Number(r.sugar_per_100g),
    saturated_fat_per_100g:
      r.saturated_fat_per_100g == null ? null : Number(r.saturated_fat_per_100g),
    salt_per_100g: r.salt_per_100g == null ? null : Number(r.salt_per_100g),
    sodium_mg_per_100g: r.sodium_mg_per_100g == null ? null : Number(r.sodium_mg_per_100g),
    serving_g: null,
    serving_label: `pro 100 ${unit}${r.default_state && r.default_state !== "n_a" ? ` (${r.default_state})` : ""}`,
    source,
    verified_by_coach: !!r.verified_by_coach,
    image_url: r.image_url ?? null,
    image_source: r.image_source ?? null,
  };
}

const FOOD_SEARCH_SELECT =
  "id,name,aliases,source,source_id,source_name,brand,barcode,image_url,image_source,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,saturated_fat_per_100g,salt_per_100g,sodium_mg_per_100g,verified_by_coach,unit_type,default_state,density_g_per_ml,is_active,safe_for_smart";

function scoreResult(r: FoodResult, q: string): number {
  const name = r.name.toLowerCase();
  const term = q.toLowerCase();
  const compactName = compactFoodTerm(name);
  const compactTerm = compactFoodTerm(term);
  let score = 0;
  if (name === term) score += 100;
  else if (compactName === compactTerm) score += 95;
  else if (name.startsWith(term)) score += 60;
  else if (compactName.startsWith(compactTerm)) score += 55;
  else if (name.includes(term)) score += 30;
  else if (compactName.includes(compactTerm)) score += 25;
  if (r.serving_g) score += 15; // hat Portionsgröße
  if (r.protein_per_100g > 0 && r.carbs_per_100g >= 0 && r.fat_per_100g >= 0) score += 10;
  if (r.brand) score += 3;
  // Kürzere Namen meist generischer / relevanter
  score -= Math.min(20, Math.max(0, name.length - term.length) / 4);
  return score;
}

function normalizeFoodTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactFoodTerm(value: string): string {
  return normalizeFoodTerm(value).replace(/\s+/g, "");
}

function sourcePriority(source: FoodSource | undefined): number {
  const prio: Record<string, number> = {
    bodyfuel_verified: 0,
    bls_4_0: 1,
    open_food_facts: 2,
    usda: 3,
    ai_estimate: 9,
  };
  return prio[source ?? ""] ?? 5;
}

/** Barcode lookup ausschließlich im intern importierten und freigegebenen Katalog. */
export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { barcode: string }) => d)
  .handler(async ({ data, context }): Promise<FoodResult> => {
    const code = data.barcode.replace(/\D/g, "");
    if (!code) throw new Error("Ungültiger Barcode");
    const { data: row, error } = await context.supabase
      .from("nutrition_foods_public")
      .select(FOOD_SEARCH_SELECT)
      .eq("barcode", code)
      .eq("is_active", true)
      .eq("safe_for_smart", true)
      .maybeSingle();
    if (error || !row) {
      throw new Error("Barcode ist noch nicht im geprüften BodyFuel-Katalog");
    }
    return mapNutritionFoodRow(row);
  });

/**
 * Kompatibilitäts-Suche. Live-Abfragen externer Datenquellen sind bewusst
 * deaktiviert: Externe Datensätze werden erst importiert, auditiert und dann
 * aus dem internen Katalog ausgeliefert.
 */
export const searchFoods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data, context }): Promise<FoodResult[]> => {
    const q = data.query.trim();
    if (!q) return [];
    const { data: rows, error } = await (context.supabase.rpc as any)("search_nutrition_foods", {
      _q: q,
      _max_results: 50,
    });
    if (error) return [];
    return ((rows ?? []) as any[])
      .map(mapNutritionFoodRow)
      .sort(
        (a, b) =>
          sourcePriority(a.source) - sourcePriority(b.source) ||
          scoreResult(b, q) - scoreResult(a, q),
      )
      .slice(0, 50);
  });

/* ----------- Targets (coach only) ----------- */

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const setNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      water_glasses: number;
      kcal_rest?: number | null;
      protein_g_rest?: number | null;
      carbs_g_rest?: number | null;
      fat_g_rest?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nz = (v: number | null | undefined) =>
      v == null || !isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v)));

    const round50 = (v: number) => Math.max(0, Math.round(v / 50) * 50);
    let kcal = round50(data.kcal);
    let protein_g = Math.max(0, Math.round(data.protein_g));
    let carbs_g = Math.max(0, Math.round(data.carbs_g));
    let fat_g = Math.max(0, Math.round(data.fat_g));
    let kcal_rest = data.kcal_rest == null ? null : round50(Number(data.kcal_rest));
    let protein_g_rest = nz(data.protein_g_rest);
    let carbs_g_rest = nz(data.carbs_g_rest);
    let fat_g_rest = nz(data.fat_g_rest);

    // Sanity: Trainingstag muss mehr kcal als Restday haben (Carb-Cycling).
    // Falls die Werte vertauscht sind, drehen wir sie.
    if (kcal_rest != null && kcal_rest > kcal) {
      [kcal, kcal_rest] = [kcal_rest, kcal];
      [protein_g, protein_g_rest] = [protein_g_rest ?? protein_g, protein_g];
      [carbs_g, carbs_g_rest] = [carbs_g_rest ?? carbs_g, carbs_g];
      [fat_g, fat_g_rest] = [fat_g_rest ?? fat_g, fat_g];
    }

    const { error } = await supabaseAdmin.from("nutrition_targets").upsert(
      {
        user_id: data.user_id,
        kcal,
        protein_g,
        carbs_g,
        fat_g,
        water_glasses: Math.max(1, Math.round(data.water_glasses)),
        kcal_rest,
        protein_g_rest,
        carbs_g_rest,
        fat_g_rest,
        updated_by: context.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    let db = context.supabase;
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }
    const { data: row, error } = await db
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/* ----------- Day type (training vs rest) ----------- */

export type DayType = "training" | "rest";

/** Returns the effective day type for a user/date, plus its source. */
export const getDayType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; date: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertCoach(context.supabase, context.userId);
    }
    const { data: override } = await context.supabase
      .from("day_type_overrides")
      .select("kind")
      .eq("user_id", data.user_id)
      .eq("entry_date", data.date)
      .maybeSingle();
    if (override?.kind) {
      return { kind: override.kind as DayType, source: "manual" as const };
    }
    // Fallback: derive from the user's configured training weekdays.
    const { data: prof } = await context.supabase
      .from("smart_nutrition_profile")
      .select("training_weekdays")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const weekdays: string[] = (prof as any)?.training_weekdays ?? [];
    if (weekdays.length) {
      const KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const wkKey = KEYS[new Date(`${data.date}T12:00:00`).getDay()];
      return {
        kind: (weekdays.map((s) => s.toLowerCase()).includes(wkKey)
          ? "training"
          : "rest") as DayType,
        source: "auto" as const,
      };
    }
    // Final fallback: did the user log a training set on this date?
    const start = `${data.date}T00:00:00`;
    const end = `${data.date}T23:59:59.999`;
    const { count } = await context.supabase
      .from("training_set_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", data.user_id)
      .gte("performed_at", start)
      .lte("performed_at", end);
    return {
      kind: ((count ?? 0) > 0 ? "training" : "rest") as DayType,
      source: "auto" as const,
    };
  });

export const setDayType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; date: string; kind: DayType | null }) => d)
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertCoach(context.supabase, context.userId);
    }
    if (data.kind === null) {
      const { error } = await context.supabase
        .from("day_type_overrides")
        .delete()
        .eq("user_id", data.user_id)
        .eq("entry_date", data.date);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("day_type_overrides")
      .upsert(
        { user_id: data.user_id, entry_date: data.date, kind: data.kind },
        { onConflict: "user_id,entry_date" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aggregate per-day kcal/macros from plan meals in the DB. Splits by day name (Restday vs Trainingstag). */
export async function computeTargetsFromPlanDB(
  supabase: any,
  planId: string,
): Promise<{
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  kcal_rest: number | null;
  protein_g_rest: number | null;
  carbs_g_rest: number | null;
  fat_g_rest: number | null;
} | null> {
  const { data: days } = await supabase
    .from("nutrition_plan_days")
    .select("id, name")
    .eq("plan_id", planId);
  const dayRows = (days ?? []) as Array<{ id: string; name: string }>;
  if (!dayRows.length) return null;

  const { data: meals } = await supabase
    .from("nutrition_plan_meals")
    .select("day_id, kcal, protein_g, carbs_g, fat_g")
    .in(
      "day_id",
      dayRows.map((d) => d.id),
    );
  const mealRows = (meals ?? []) as any[];
  if (!mealRows.length) return null;

  // sum per day
  const perDay = new Map<string, { kcal: number; p: number; c: number; f: number }>();
  for (const m of mealRows) {
    const cur = perDay.get(m.day_id) ?? { kcal: 0, p: 0, c: 0, f: 0 };
    cur.kcal += Number(m.kcal) || 0;
    cur.p += Number(m.protein_g) || 0;
    cur.c += Number(m.carbs_g) || 0;
    cur.f += Number(m.fat_g) || 0;
    perDay.set(m.day_id, cur);
  }

  const train: { kcal: number; p: number; c: number; f: number }[] = [];
  const rest: { kcal: number; p: number; c: number; f: number }[] = [];
  for (const d of dayRows) {
    const totals = perDay.get(d.id);
    if (!totals || totals.kcal <= 0) continue;
    const isRest = /rest|regen|off|frei/i.test(d.name);
    (isRest ? rest : train).push(totals);
  }

  const avg = (arr: typeof train) => {
    if (!arr.length) return null;
    const n = arr.length;
    return {
      kcal: Math.round(arr.reduce((s, x) => s + x.kcal, 0) / n),
      protein_g: Math.round(arr.reduce((s, x) => s + x.p, 0) / n),
      carbs_g: Math.round(arr.reduce((s, x) => s + x.c, 0) / n),
      fat_g: Math.round(arr.reduce((s, x) => s + x.f, 0) / n),
    };
  };

  // If no Trainingstag rows exist, treat all days as training
  let base = train.length ? avg(train) : avg([...train, ...rest]);
  let restAvg = train.length ? avg(rest) : null;
  if (!base) return null;

  // Sportwissenschaftlicher Sanity-Check: Trainingstag MUSS mehr kcal als Restday haben
  // (Carb-Cycling: höherer Carb-Bedarf an Trainingstagen). Wenn die Labels offenbar vertauscht
  // sind (z. B. AI hat Tagesnamen falsch zugeordnet), drehen wir die beiden Sätze.
  if (restAvg && restAvg.kcal > base.kcal) {
    [base, restAvg] = [restAvg, base];
  }

  return {
    ...base,
    kcal_rest: restAvg?.kcal ?? null,
    protein_g_rest: restAvg?.protein_g ?? null,
    carbs_g_rest: restAvg?.carbs_g ?? null,
    fat_g_rest: restAvg?.fat_g ?? null,
  };
}

/**
 * Sportwissenschaftlich abgeleitete Restday-Werte, wenn der Coach nur Trainingstag-Werte gesetzt hat.
 * Quelle: ISSN Position Stand on Nutrient Timing & Carb-Cycling-Empfehlungen
 *   - Protein: konstant (≈ 1.6–2.0 g/kg; 2.0 g/kg ist die harte Obergrenze).
 *   - Fett: an Restdays leicht höher (Energieersatz für reduzierte Carbs), ~+10 %.
 *   - Kohlenhydrate: Trainingstag 4–6 g/kg, Restday 2–3 g/kg → Restday ≈ 65 % der Trainingstag-Carbs.
 *   - Kalorien: ergeben sich aus den Makros (P*4 + C*4 + F*9).
 */
export function deriveRestFromTraining(t: {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}) {
  const round50 = (v: number) => Math.max(50, Math.round(v / 50) * 50);
  const protein_g = t.protein_g;
  let carbs_g = Math.round(t.carbs_g * 0.65);
  let fat_g = Math.round(t.fat_g * 1.1);
  let kcal = round50(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  if (kcal >= t.kcal || carbs_g >= t.carbs_g) {
    carbs_g = Math.round(t.carbs_g * 0.55);
    fat_g = Math.round(t.fat_g * 1.05);
    kcal = Math.max(
      50,
      Math.min(round50(t.kcal - 100), round50(protein_g * 4 + carbs_g * 4 + fat_g * 9)),
    );
  }
  return { kcal, protein_g, carbs_g, fat_g };
}

/** Extract daily kcal/macros from the user's active nutrition plan (DB first, PDF fallback) */
export const extractTargetsFromPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, file_path, source, kcal, protein_g, carbs_g, fat_g")
      .eq("client_id", data.user_id)
      .eq("plan_type", "nutrition")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) throw new Error("Kein aktiver Ernährungsplan vorhanden");

    // 1) DB aggregation (works for Smart-Plans and any plan with meals)
    const dbTargets = await computeTargetsFromPlanDB(supabaseAdmin, (plan as any).id);
    if (dbTargets && dbTargets.kcal > 0) {
      return { ...dbTargets, water_glasses: null as number | null };
    }

    // 2) Plan row totals (Smart-Plan often stores aggregate macros directly)
    const pk = Number((plan as any).kcal) || 0;
    if (pk > 0) {
      return {
        kcal: pk,
        protein_g: Math.round(Number((plan as any).protein_g) || 0),
        carbs_g: Math.round(Number((plan as any).carbs_g) || 0),
        fat_g: Math.round(Number((plan as any).fat_g) || 0),
        kcal_rest: null,
        protein_g_rest: null,
        carbs_g_rest: null,
        fat_g_rest: null,
        water_glasses: null as number | null,
      };
    }

    // 3) PDF fallback
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Keine Werte im Plan und kein LOVABLE_API_KEY für PDF-Fallback");
    if (!(plan as any).file_path)
      throw new Error("Keine Werte im Plan gefunden. Bitte manuell eintragen.");

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("nutrition-plans")
      .download((plan as any).file_path);
    if (dlErr || !file) throw new Error(dlErr?.message || "Plan konnte nicht geladen werden");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    const prompt = `Du bekommst einen Ernährungsplan als PDF. Extrahiere die TÄGLICHEN Zielwerte (Tagessummen, NICHT pro Mahlzeit).

ERKENNUNG TRAININGSTAG vs RESTDAY:
Suche nach Sektionen mit Überschriften wie:
- TRAININGSTAG: "TRAININGSTAG", "Training Day", "Workout", "Football/Gym", "Gesamtwerte Trainingstag"
- RESTDAY: "RESTDAY", "Rest Day", "Regeneration", "trainingsfreier Tag", "Off-Day", "Refeed-frei", "Gesamtwerte Restday"
Wenn der Plan BEIDE Varianten enthält, gib BEIDE Sätze zurück. Nutze bevorzugt die "Gesamtwerte"-Zeilen am Ende jeder Sektion; sonst summiere alle Mahlzeiten der Sektion. Wenn keine Unterscheidung: nur Standardsatz, _rest-Felder = null.

WERTBEREICHE:
Bei Bereichen (z.B. "3200–3400 kcal" oder "255–265 g") nimm den MITTELWERT und runde auf ganze Zahlen (3300, 260). Ignoriere "~" / "ca.".

Antworte ausschließlich mit gültigem JSON:
{ "kcal": <int>, "protein_g": <int>, "carbs_g": <int>, "fat_g": <int>,
  "kcal_rest": <int|null>, "protein_g_rest": <int|null>, "carbs_g_rest": <int|null>, "fat_g_rest": <int|null>,
  "water_l": <number|null> }`;

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
                file: { filename: "plan.pdf", file_data: `data:application/pdf;base64,${b64}` },
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
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Antwort konnte nicht gelesen werden");
    }

    const nz = (v: any) => {
      const n = Number(v);
      return isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const kcal = Math.max(0, Math.round(Number(parsed.kcal) || 0));
    const protein_g = Math.max(0, Math.round(Number(parsed.protein_g) || 0));
    const carbs_g = Math.max(0, Math.round(Number(parsed.carbs_g) || 0));
    const fat_g = Math.max(0, Math.round(Number(parsed.fat_g) || 0));
    const water_l = Number(parsed.water_l);
    const water_glasses =
      isFinite(water_l) && water_l > 0 ? Math.max(4, Math.round((water_l * 1000) / 250)) : null;

    if (!kcal && !protein_g) {
      throw new Error("Keine Werte im Plan gefunden. Bitte manuell eintragen.");
    }
    return {
      kcal,
      protein_g,
      carbs_g,
      fat_g,
      kcal_rest: nz(parsed.kcal_rest),
      protein_g_rest: nz(parsed.protein_g_rest),
      carbs_g_rest: nz(parsed.carbs_g_rest),
      fat_g_rest: nz(parsed.fat_g_rest),
      water_glasses,
    };
  });

/* ----------- KI-Schätzung (Fallback für fehlende Katalog-Einträge) ----------- */

/**
 * Schätzt Makros für ein Lebensmittel per Lovable AI.
 * Ergebnis wird als FoodResult mit Quelle `ai_estimate` zurückgegeben — es wird NICHT
 * in den Katalog geschrieben. Der User bestätigt Menge im Amount-Editor.
 */
export const estimateFoodFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => {
    if (!d?.query?.trim()) throw new Error("Bitte Lebensmittel angeben.");
    return d;
  })
  .handler(async ({ data }): Promise<FoodResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("KI-Schätzung nicht verfügbar (LOVABLE_API_KEY fehlt).");
    const query = data.query.trim();

    const prompt = `Schätze Nährwerte pro 100 g (oder pro 100 ml bei Flüssigkeiten) für dieses Lebensmittel: "${query}".
Nutze übliche europäische Durchschnittswerte (BLS/USDA-nah). Kohlenhydrate OHNE Ballaststoffe.
Antworte NUR mit gültigem JSON:
{"name":"Kurzer deutscher Name","unit":"g"|"ml","kcal_per_100g":number,"protein_per_100g":number,"carbs_per_100g":number,"fat_per_100g":number,"fiber_per_100g":number|null}`;

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
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden.");
    }

    const unit: FoodAmountUnit = parsed.unit === "ml" ? "ml" : "g";
    const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return {
      id: null,
      name: String(parsed.name || query).slice(0, 120),
      brand: null,
      barcode: null,
      unit,
      density_g_per_ml: null,
      kcal_per_100g: num(parsed.kcal_per_100g),
      protein_per_100g: num(parsed.protein_per_100g),
      carbs_per_100g: num(parsed.carbs_per_100g),
      fat_per_100g: num(parsed.fat_per_100g),
      fiber_per_100g: parsed.fiber_per_100g == null ? null : num(parsed.fiber_per_100g),
      serving_g: null,
      serving_label: `KI-Schätzung pro 100 ${unit}`,
      source: "ai_estimate",
      verified_by_coach: false,
      image_url: null,
      image_source: null,
    };
  });

/* ----------- BodyFuel Lebensmittel-DB (BLS 4.0 + verified) ----------- */

/**
 * Sucht ausschließlich im freigegebenen BodyFuel-Katalog.
 */
export const searchFoodsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; limit?: number }) => d)
  .handler(async ({ data, context }): Promise<FoodResult[]> => {
    const q = data.query.trim();
    if (!q) return [];
    const limit = Math.min(50, Math.max(1, data.limit ?? 15));
    const { data: rows, error } = await (context.supabase.rpc as any)("search_nutrition_foods", {
      _q: q,
      _max_results: limit,
    });
    if (error) return [];
    const term = q.toLowerCase();
    const mapped: FoodResult[] = ((rows ?? []) as any[]).map(mapNutritionFoodRow);
    mapped.sort((a, b) => {
      const pa = sourcePriority(a.source);
      const pb = sourcePriority(b.source);
      if (pa !== pb) return pa - pb;
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      const ax = an === term ? 0 : an.startsWith(term) ? 1 : 2;
      const bx = bn === term ? 0 : bn.startsWith(term) ? 1 : 2;
      return ax - bx || scoreResult(b, q) - scoreResult(a, q);
    });
    return mapped.slice(0, limit);
  });

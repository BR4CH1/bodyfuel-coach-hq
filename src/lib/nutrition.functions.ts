import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  /** Gramm pro Stück/Portion (z.B. 1 Scheibe Toast = 25g), falls bekannt */
  serving_g: number | null;
  /** Roh-Label von OFF, z.B. "1 slice (25g)" oder "30 g" */
  serving_label: string | null;
  /** Datenquelle (bls_4_0, bodyfuel_verified, open_food_facts, usda, ai_estimate, …) */
  source?: FoodSource;
  /** True wenn Coach geprüft */
  verified_by_coach?: boolean;
};

function mapOff(p: any): FoodResult | null {
  const n = p?.nutriments;
  if (!n) return null;
  const kcal = Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0);
  const protein = Number(n["proteins_100g"] ?? 0);
  // Quality filter: must have at least kcal AND (protein or carbs/fat)
  if (!kcal || (!protein && !Number(n["carbohydrates_100g"]) && !Number(n["fat_100g"]))) {
    return null;
  }
  const sq = Number(p.serving_quantity);
  const serving_g = isFinite(sq) && sq > 0 ? sq : null;
  return {
    name:
      p.product_name_de ||
      p.product_name ||
      p.generic_name_de ||
      p.generic_name ||
      "Unbekannt",
    brand: p.brands || null,
    barcode: p.code || null,
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: Number(n["carbohydrates_100g"] ?? 0),
    fat_per_100g: Number(n["fat_100g"] ?? 0),
    serving_g,
    serving_label: (p.serving_size as string) || null,
    source: "open_food_facts",
    verified_by_coach: false,
  };
}

function scoreResult(r: FoodResult, q: string): number {
  const name = r.name.toLowerCase();
  const term = q.toLowerCase();
  let score = 0;
  if (name === term) score += 100;
  else if (name.startsWith(term)) score += 60;
  else if (name.includes(term)) score += 30;
  if (r.serving_g) score += 15; // hat Portionsgröße
  if (r.protein_per_100g > 0 && r.carbs_per_100g >= 0 && r.fat_per_100g >= 0) score += 10;
  if (r.brand) score += 3;
  // Kürzere Namen meist generischer / relevanter
  score -= Math.min(20, Math.max(0, name.length - term.length) / 4);
  return score;
}

/** Barcode lookup via OpenFoodFacts */
export const lookupBarcode = createServerFn({ method: "POST" })
  .inputValidator((d: { barcode: string }) => d)
  .handler(async ({ data }) => {
    const code = data.barcode.replace(/\D/g, "");
    if (!code) throw new Error("Ungültiger Barcode");
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    if (!res.ok) throw new Error("Produkt nicht gefunden");
    const json = (await res.json()) as any;
    if (json.status !== 1) throw new Error("Produkt nicht gefunden");
    const mapped = mapOff(json.product);
    if (!mapped) throw new Error("Keine Nährwerte für dieses Produkt");
    return mapped;
  });

/** Search foods: DB + OFF in parallel mit harten Timeouts — UI hängt nie. */
export const searchFoods = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = data.query.trim();
    if (!q) return [] as FoodResult[];

    const seen = new Set<string>();
    const arr: FoodResult[] = [];
    const pushUnique = (m: FoodResult | null) => {
      if (!m) return;
      const key = (m.barcode || m.name.toLowerCase()) + "|" + (m.brand ?? "").toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      arr.push(m);
    };

    const fetchWithTimeout = async (url: string, ms: number) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "BodyFuelCoaching/1.0 (coach app)" },
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as any;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    };

    // DB-Lookup (geprüfte Lebensmittel)
    let dbRows: FoodResult[] = [];
    const dbPromise = (async () => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows } = await supabaseAdmin
          .from("nutrition_foods")
          .select(
            "name, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, default_state",
          )
          .or(`name.ilike.%${q}%,aliases.cs.{${q.toLowerCase()}}`)
          .eq("needs_review", false)
          .limit(15);
        dbRows = (rows ?? []).map((r: any) => ({
          name: r.name,
          brand: null,
          barcode: null,
          kcal_per_100g: Number(r.kcal_per_100g) || 0,
          protein_per_100g: Number(r.protein_per_100g) || 0,
          carbs_per_100g: Number(r.carbs_per_100g) || 0,
          fat_per_100g: Number(r.fat_per_100g) || 0,
          serving_g: null,
          serving_label: r.default_state ? `pro 100 g (${r.default_state})` : null,
          source: r.source,
          verified_by_coach: !!r.verified_by_coach,
        }));
      } catch {
        /* ignore */
      }
    })();

    const offUrl =
      `https://search.openfoodfacts.org/search?` +
      `q=${encodeURIComponent(q)}` +
      `&langs=de,en&page_size=30&fields=code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_size,serving_quantity` +
      `&sort_by=-popularity_key&countries_tags=germany,switzerland,austria`;
    const fields =
      "code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_size,serving_quantity";
    const deUrl = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n&fields=${fields}`;

    // Alles parallel mit hartem Timeout. Egal welche Quelle wegfällt — Suche kommt zurück.
    const [, offJson, deJson] = await Promise.all([
      dbPromise,
      fetchWithTimeout(offUrl, 3500),
      fetchWithTimeout(deUrl, 3500),
    ]);

    for (const m of dbRows) pushUnique(m);
    if (offJson) for (const p of offJson.hits ?? offJson.products ?? []) pushUnique(mapOff(p));
    if (deJson) for (const p of deJson.products ?? []) pushUnique(mapOff(p));

    arr.sort((a, b) => scoreResult(b, q) - scoreResult(a, q));
    return arr.slice(0, 25);
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
    await assertCoach(context.supabase, context.userId);
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
        kcal, protein_g, carbs_g, fat_g,
        water_glasses: Math.max(1, Math.round(data.water_glasses)),
        kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest,
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
    if (data.user_id !== context.userId) {
      await assertCoach(context.supabase, context.userId);
    }
    const { data: row, error } = await context.supabase
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
      const KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
      const wkKey = KEYS[new Date(`${data.date}T12:00:00`).getDay()];
      return {
        kind: (weekdays.map((s) => s.toLowerCase()).includes(wkKey) ? "training" : "rest") as DayType,
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
  .inputValidator(
    (d: { user_id: string; date: string; kind: DayType | null }) => d,
  )
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
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  kcal_rest: number | null; protein_g_rest: number | null;
  carbs_g_rest: number | null; fat_g_rest: number | null;
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
    .in("day_id", dayRows.map((d) => d.id));
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
 *   - Protein: konstant (≈ 1.8–2.2 g/kg, anabole Schwelle ganztägig).
 *   - Fett: an Restdays leicht höher (Energieersatz für reduzierte Carbs), ~+10 %.
 *   - Kohlenhydrate: Trainingstag 4–6 g/kg, Restday 2–3 g/kg → Restday ≈ 65 % der Trainingstag-Carbs.
 *   - Kalorien: ergeben sich aus den Makros (P*4 + C*4 + F*9).
 */
export function deriveRestFromTraining(t: {
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
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
    await assertCoach(context.supabase, context.userId);

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
    if (!(plan as any).file_path) throw new Error("Keine Werte im Plan gefunden. Bitte manuell eintragen.");

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
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "file", file: { filename: "plan.pdf", file_data: `data:application/pdf;base64,${b64}` } },
        ] }],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { throw new Error("Antwort konnte nicht gelesen werden"); }

    const nz = (v: any) => {
      const n = Number(v);
      return isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const kcal = Math.max(0, Math.round(Number(parsed.kcal) || 0));
    const protein_g = Math.max(0, Math.round(Number(parsed.protein_g) || 0));
    const carbs_g = Math.max(0, Math.round(Number(parsed.carbs_g) || 0));
    const fat_g = Math.max(0, Math.round(Number(parsed.fat_g) || 0));
    const water_l = Number(parsed.water_l);
    const water_glasses = isFinite(water_l) && water_l > 0
      ? Math.max(4, Math.round((water_l * 1000) / 250))
      : null;

    if (!kcal && !protein_g) {
      throw new Error("Keine Werte im Plan gefunden. Bitte manuell eintragen.");
    }
    return {
      kcal, protein_g, carbs_g, fat_g,
      kcal_rest: nz(parsed.kcal_rest),
      protein_g_rest: nz(parsed.protein_g_rest),
      carbs_g_rest: nz(parsed.carbs_g_rest),
      fat_g_rest: nz(parsed.fat_g_rest),
      water_glasses,
    };
  });

/* ----------- Schätzung von Nährwerten ----------- */

/**
 * Schätzt Nährwerte (pro 100g) für ein Lebensmittel/Gericht per KI,
 * wenn weder OpenFoodFacts noch unsere lokale DB einen Treffer liefern.
 * Beispiele: "Döner Kalb mit Soße", "Pizza Salami", "Caesar Salat mit Hähnchen".
 */
export const estimateFoodFromText = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<FoodResult> => {
    const q = data.query.trim();
    if (!q) throw new Error("Bitte gib ein Lebensmittel ein.");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Schätzung nicht verfügbar (LOVABLE_API_KEY fehlt).");

    const system = `Du bist Ernährungswissenschaftler. Schätze Nährwerte für ein vom Nutzer beschriebenes Lebensmittel oder Gericht (deutsche Esskultur, typische Zubereitung). Antworte ausschließlich mit JSON. Werte IMMER pro 100 g. Sei realistisch (z.B. Döner ~215 kcal/100g, Pizza Salami ~265 kcal/100g, Pommes ~290 kcal/100g). Wenn du dir gar nicht sicher bist, gib trotzdem die plausibelste Schätzung ab.

JSON-Schema:
{
  "name": "klarer Name auf Deutsch",
  "kcal_per_100g": <number>,
  "protein_per_100g": <number>,
  "carbs_per_100g": <number>,
  "fat_per_100g": <number>,
  "serving_g": <number|null>,
  "serving_label": "<string|null, z.B. '1 Stück ca. 300 g'>"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: q },
        ],
      }),
    });
    if (aiRes.status === 429) throw new Error("Rate-Limit erreicht – kurz warten.");
    if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { throw new Error("Antwort konnte nicht gelesen werden."); }

    const num = (v: any) => {
      const n = Number(v);
      return isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
    };
    const kcal = num(parsed.kcal_per_100g);
    if (!kcal) throw new Error("Schätzung nicht möglich – bitte präziser beschreiben.");
    const sg = Number(parsed.serving_g);
    return {
      name: `${String(parsed.name || q)} (geschätzt)`,
      brand: null,
      barcode: null,
      kcal_per_100g: kcal,
      protein_per_100g: num(parsed.protein_per_100g),
      carbs_per_100g: num(parsed.carbs_per_100g),
      fat_per_100g: num(parsed.fat_per_100g),
      serving_g: isFinite(sg) && sg > 0 ? Math.round(sg) : null,
      serving_label: parsed.serving_label || null,
      source: "ai_estimate",
      verified_by_coach: false,
    };
  });

/* ----------- BodyFuel Lebensmittel-DB (BLS 4.0 + verified) ----------- */

/**
 * Sucht in unserer geprüften Nährwert-DB (BLS 4.0 + Coach-verified).
 * Wird VOR OpenFoodFacts angefragt, damit Grundnahrungsmittel immer
 * geprüfte Werte liefern.
 */
export const searchFoodsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; limit?: number }) => d)
  .handler(async ({ data, context }): Promise<FoodResult[]> => {
    const q = data.query.trim();
    if (!q) return [];
    const limit = Math.min(25, Math.max(1, data.limit ?? 15));
    // ILIKE on name + aliases (text[] -> use array_to_string for cheap fuzzy)
    const { data: rows, error } = await context.supabase
      .from("nutrition_foods")
      .select(
        "name, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, unit_type, default_state, aliases",
      )
      .or(`name.ilike.%${q}%,aliases.cs.{${q.toLowerCase()}}`)
      .eq("needs_review", false)
      .limit(limit);
    if (error) return [];
    const term = q.toLowerCase();
    const mapped: FoodResult[] = (rows ?? []).map((r: any) => ({
      name: r.name,
      brand: null,
      barcode: null,
      kcal_per_100g: Number(r.kcal_per_100g) || 0,
      protein_per_100g: Number(r.protein_per_100g) || 0,
      carbs_per_100g: Number(r.carbs_per_100g) || 0,
      fat_per_100g: Number(r.fat_per_100g) || 0,
      serving_g: null,
      serving_label: r.default_state ? `pro 100 g (${r.default_state})` : null,
      source: r.source,
      verified_by_coach: !!r.verified_by_coach,
    }));
    // Source-Priorität: bodyfuel_verified > bls_4_0 > rest
    const prio: Record<string, number> = {
      bodyfuel_verified: 0,
      bls_4_0: 1,
      open_food_facts: 2,
      usda: 3,
      ai_estimate: 9,
    };
    mapped.sort((a, b) => {
      const pa = prio[a.source ?? ""] ?? 5;
      const pb = prio[b.source ?? ""] ?? 5;
      if (pa !== pb) return pa - pb;
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      const ax = an === term ? 0 : an.startsWith(term) ? 1 : 2;
      const bx = bn === term ? 0 : bn.startsWith(term) ? 1 : 2;
      return ax - bx;
    });
    return mapped;
  });



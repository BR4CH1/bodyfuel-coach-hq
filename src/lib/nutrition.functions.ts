import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Search foods: Search-a-licious (smart relevance) + legacy OFF fallback. */
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

    // 1) Search-a-licious — neue OFF-Suche, deutlich bessere Relevanz
    try {
      const url =
        `https://search.openfoodfacts.org/search?` +
        `q=${encodeURIComponent(q)}` +
        `&langs=de,en&page_size=30&fields=code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_size,serving_quantity` +
        `&sort_by=-popularity_key&countries_tags=germany,switzerland,austria`;
      const res = await fetch(url, {
        headers: { "User-Agent": "BodyFuelCoaching/1.0 (coach app)" },
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        for (const p of json.hits ?? json.products ?? []) {
          pushUnique(mapOff(p));
        }
      }
    } catch {
      /* fall through */
    }

    // 2) Fallback: klassische Suche (DE, dann World), falls Search-a-licious zu wenig liefert
    if (arr.length < 8) {
      const fields =
        "code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_size,serving_quantity";
      const urls = [
        `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n&fields=${fields}`,
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n&fields=${fields}`,
      ];
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "BodyFuelCoaching/1.0 (coach app)" },
          });
          if (!res.ok) continue;
          const json = (await res.json()) as any;
          for (const p of json.products ?? []) pushUnique(mapOff(p));
          if (arr.length >= 15) break;
        } catch {
          /* try next */
        }
      }
    }

    // Eigene Relevanz-Sortierung
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
    const { error } = await supabaseAdmin.from("nutrition_targets").upsert(
      {
        user_id: data.user_id,
        kcal: Math.max(0, Math.round(data.kcal)),
        protein_g: Math.max(0, Math.round(data.protein_g)),
        carbs_g: Math.max(0, Math.round(data.carbs_g)),
        fat_g: Math.max(0, Math.round(data.fat_g)),
        water_glasses: Math.max(1, Math.round(data.water_glasses)),
        kcal_rest: nz(data.kcal_rest),
        protein_g_rest: nz(data.protein_g_rest),
        carbs_g_rest: nz(data.carbs_g_rest),
        fat_g_rest: nz(data.fat_g_rest),
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

/** Extract daily kcal/macros from the user's active nutrition plan PDF via Lovable AI */
export const extractTargetsFromPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error: pErr } = await supabaseAdmin
      .from("nutrition_plans")
      .select("file_path")
      .eq("client_id", data.user_id)
      .eq("plan_type", "nutrition")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!plan) throw new Error("Kein aktiver Ernährungsplan vorhanden");

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("nutrition-plans")
      .download(plan.file_path);
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

Felder:
- kcal, protein_g, carbs_g, fat_g: TRAININGSTAG (oder Standardtag).
- kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest: RESTDAY, sonst null.
- water_l: Wasser in Litern pro Tag, oder null.

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
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden");
    }

    const nz = (v: any) => {
      const n = Number(v);
      return isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const kcal = Math.max(0, Math.round(Number(parsed.kcal) || 0));
    const protein_g = Math.max(0, Math.round(Number(parsed.protein_g) || 0));
    const carbs_g = Math.max(0, Math.round(Number(parsed.carbs_g) || 0));
    const fat_g = Math.max(0, Math.round(Number(parsed.fat_g) || 0));
    const kcal_rest = nz(parsed.kcal_rest);
    const protein_g_rest = nz(parsed.protein_g_rest);
    const carbs_g_rest = nz(parsed.carbs_g_rest);
    const fat_g_rest = nz(parsed.fat_g_rest);
    const water_l = Number(parsed.water_l);
    const water_glasses = isFinite(water_l) && water_l > 0
      ? Math.max(4, Math.round((water_l * 1000) / 250))
      : null;

    if (!kcal && !protein_g) {
      throw new Error("Keine Werte im Plan gefunden. Bitte manuell eintragen.");
    }
    return {
      kcal, protein_g, carbs_g, fat_g,
      kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest,
      water_glasses,
    };
  });

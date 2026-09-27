import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReviewItem } from "@/features/nutrition-tracker/lib/quick-food-log.logic";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DAILY_LIMIT = 30;
const CACHE_MINUTES = 10;

export type QuickLogDraft = {
  draftId: string;
  items: ReviewItem[];
  dateAdjusted: boolean;
  cached: boolean;
  empty: boolean;
};

function friendly(e: unknown): never {
  const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
  throw new Error(msg);
}

export const parseFoodLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().trim().min(2, "Bitte beschreibe, was du gegessen hast.").max(2000, "Text ist zu lang (max. 2.000 Zeichen)."),
        date: isoDate,
        today: isoDate,
        input_mode: z.enum(["text", "voice"]).default("text"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<QuickLogDraft> => {
    const { supabase, userId } = context;
    const { textHash } = await import("@/features/nutrition-tracker/lib/quick-food-log.logic");
    const hash = textHash(`${data.date}|${data.text}`);

    // Cache: identischer Text in den letzten 10 Minuten → gleichen Entwurf zurückgeben.
    const since = new Date(Date.now() - CACHE_MINUTES * 60_000).toISOString();
    const { data: cached } = await supabase
      .from("food_log_drafts")
      .select("id, parsed, status")
      .eq("user_id", userId)
      .eq("text_hash", hash)
      .eq("status", "parsed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.parsed && Array.isArray((cached.parsed as any).items)) {
      const p = cached.parsed as any;
      return { draftId: cached.id, items: p.items, dateAdjusted: !!p.dateAdjusted, cached: true, empty: p.items.length === 0 };
    }

    // Tageslimit
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("food_log_drafts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayStart.toISOString());
    if ((count ?? 0) >= DAILY_LIMIT) {
      throw new Error("Tageslimit für Schnell-Einträge erreicht. Bitte nutze heute die normale Suche.");
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Analyse ist gerade nicht verfügbar.");

    try {
      const { aiParseFoodText, buildReviewItems } = await import("@/lib/quick-food-log.server");
      const { runCatalogSearch } = await import("@/lib/nutrition.functions");
      const parsed = await aiParseFoodText(apiKey, data.text);
      const { items, dateAdjusted } = parsed.length
        ? await buildReviewItems({
            supabase,
            userId,
            apiKey,
            parsed,
            baseDate: data.date,
            today: data.today,
            search: (q) => runCatalogSearch(supabase, q, 12, userId),
          })
        : { items: [], dateAdjusted: false };

      const { data: row, error } = await supabase
        .from("food_log_drafts")
        .insert({
          user_id: userId,
          raw_text: data.text,
          text_hash: hash,
          input_mode: data.input_mode,
          parsed: { items, dateAdjusted } as any,
          resolved_date: data.date,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { draftId: row.id, items, dateAdjusted, cached: false, empty: items.length === 0 };
    } catch (e) {
      console.error("[quick-log] parse", e);
      friendly(e);
    }
  });

export const correctFoodLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        draftId: z.string().uuid(),
        correction: z.string().trim().min(2).max(500),
        items: z.array(z.any()).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ items: ReviewItem[]; usedAi: boolean; changed: number }> => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase
      .from("food_log_drafts")
      .select("id,status")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!draft || draft.status !== "parsed") throw new Error("Entwurf nicht mehr bearbeitbar.");

    const logic = await import("@/features/nutrition-tracker/lib/quick-food-log.logic");
    let items = data.items as ReviewItem[];
    const local = logic.parseLocalCorrection(data.correction, items);
    let usedAi = false;
    let changed = 0;
    if (local) {
      items = items.map((it) => {
        const c = local.find((l) => l.key === it.key);
        if (!c) return it;
        changed++;
        return logic.applyAmountChange(it, c.amount);
      });
    } else {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("Korrektur ist gerade nicht verfügbar.");
      const { aiCorrection } = await import("@/lib/quick-food-log.server");
      usedAi = true;
      const changes = await aiCorrection(apiKey, data.correction, items).catch((e) => friendly(e));
      const removed = new Set(changes.filter((c) => c.remove).map((c) => c.key));
      items = items
        .filter((it) => !removed.has(it.key))
        .map((it) => {
          const c = changes.find((x) => x.key === it.key && !x.remove && x.amount != null);
          if (!c) return it;
          changed++;
          return logic.applyAmountChange(it, Number(c.amount));
        });
      changed += removed.size;
    }
    await supabase.from("food_log_drafts").update({ parsed: { items } as any }).eq("id", data.draftId);
    return { items, usedAi, changed };
  });

const commitItem = z.object({
  key: z.string().min(1).max(80),
  entry_date: isoDate,
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  amount: z.number().positive().max(5000),
  unit: z.enum(["g", "ml"]),
  label: z.string().max(200),
  phrase: z.string().max(300),
  estimate_level: z.enum(["exact", "matched", "estimated"]),
  food: z
    .object({
      food_id: z.string().nullable(),
      name: z.string().max(200),
      brand: z.string().nullable(),
      unit: z.enum(["g", "ml"]),
      kcal_per_100g: z.number().min(0).max(1000),
      protein_per_100g: z.number().min(0).max(100),
      carbs_per_100g: z.number().min(0).max(100),
      fat_per_100g: z.number().min(0).max(100),
      source: z.string().max(40),
    })
    .nullable(),
});

export const commitFoodLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ draftId: z.string().uuid(), items: z.array(commitItem).min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ inserted: number; alreadyCommitted: boolean }> => {
    const { supabase, userId } = context;
    const { checkFoodEnergy } = await import("@/lib/food-energy");
    const { toCommitItem } = await import("@/features/nutrition-tracker/lib/quick-food-log.logic");

    const { data: draft } = await supabase
      .from("food_log_drafts")
      .select("id,status,parsed")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!draft) throw new Error("Entwurf nicht gefunden.");
    if (draft.status === "committed") return { inserted: 0, alreadyCommitted: true };

    // Katalogwerte serverseitig neu laden — Browserwerte sind nicht die Wahrheit.
    const ids = [...new Set(data.items.map((i) => i.food?.food_id).filter(Boolean) as string[])];
    const catalog = new Map<string, any>();
    if (ids.length) {
      const { data: rows } = await supabase
        .from("nutrition_foods")
        .select("id,name,brand,unit_type,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g")
        .in("id", ids);
      for (const r of rows ?? []) catalog.set(r.id, r);
    }

    const payload = data.items.map((it) => {
      if (!it.food) throw new Error(`„${it.label}" hat noch kein Lebensmittel.`);
      let food = { ...it.food, serving_g: null as number | null, verified: false };
      const row = it.food.food_id ? catalog.get(it.food.food_id) : null;
      if (row) {
        food = {
          ...food,
          name: row.name,
          brand: row.brand ?? food.brand,
          kcal_per_100g: Number(row.kcal_per_100g) || 0,
          protein_per_100g: Number(row.protein_per_100g) || 0,
          carbs_per_100g: Number(row.carbs_per_100g) || 0,
          fat_per_100g: Number(row.fat_per_100g) || 0,
        };
      } else {
        food.food_id = null;
        const e = checkFoodEnergy(food);
        food.kcal_per_100g = e.kcal_per_100g;
      }
      return toCommitItem({
        ...(it as any),
        food,
        unit: food.unit,
        amount_note: null,
        amount_estimated: false,
        match_score: 0,
        confidence: "high",
        warnings: [],
        confirmed: true,
      });
    });

    const { data: result, error } = await supabase.rpc("commit_food_log" as any, {
      _draft_id: data.draftId,
      _items: payload as any,
    });
    if (error) {
      console.error("[quick-log] commit", error);
      throw new Error("Speichern fehlgeschlagen — bitte erneut versuchen.");
    }
    const r = (result ?? {}) as { inserted?: number; already_committed?: boolean };
    return { inserted: r.inserted ?? 0, alreadyCommitted: !!r.already_committed };
  });

export const discardFoodLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ draftId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("food_log_drafts")
      .update({ status: "discarded" })
      .eq("id", data.draftId)
      .eq("user_id", context.userId)
      .eq("status", "parsed");
    return { ok: true };
  });

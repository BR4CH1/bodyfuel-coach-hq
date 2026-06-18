import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(supabase: any, userId: string) {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Forbidden — Coach-Rolle erforderlich");
}

export type NutritionAdjustment = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rationale: string;
};

export type TrainingAdjustment = {
  area: "volume" | "intensity" | "frequency" | "exercise_swap" | "deload";
  detail: string;
  rationale: string;
};

export type PlanAdjustmentSuggestion = {
  summary: string;
  confidence: "high" | "medium" | "low";
  nutrition: NutritionAdjustment | null;
  training: TrainingAdjustment[];
  warnings: string[];
};

export type PlanAdjustmentVariant = PlanAdjustmentSuggestion & {
  label: "Konservativ" | "Aggressiv";
};

export type PlanAdjustmentResponse = {
  current: any;
  variants: PlanAdjustmentVariant[];
};

export const generatePlanAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }): Promise<PlanAdjustmentResponse> => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const target = data.user_id;
    const today = new Date();
    const since14 = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const since30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);

    const [profileRes, targetsRes, checkinsRes, weightsRes, foodsRes, sessionsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, gender, height_cm, current_weight_kg, target_weight_kg, goal, activity_level, birthdate")
          .eq("id", target)
          .maybeSingle(),
        supabase
          .from("nutrition_targets")
          .select("kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest")
          .eq("user_id", target)
          .maybeSingle(),
        supabase
          .from("weekly_checkins")
          .select("week_start, weight_kg, training_adherence, nutrition_adherence, energy, sleep_quality, struggles")
          .eq("user_id", target)
          .order("week_start", { ascending: false })
          .limit(4),
        supabase
          .from("bulls_weight_logs")
          .select("log_date, weight_kg")
          .eq("user_id", target)
          .gte("log_date", since30)
          .order("log_date", { ascending: false }),
        supabase
          .from("food_entries")
          .select("entry_date, kcal, protein_g, carbs_g, fat_g")
          .eq("user_id", target)
          .gte("entry_date", since14),
        supabase
          .from("training_sessions")
          .select("session_date, status")
          .eq("client_id", target)
          .gte("session_date", since14),
      ]);

    const dayMap = new Map<string, { kcal: number; p: number; c: number; f: number }>();
    (foodsRes.data ?? []).forEach((f: any) => {
      const day = String(f.entry_date).slice(0, 10);
      const m = dayMap.get(day) ?? { kcal: 0, p: 0, c: 0, f: 0 };
      m.kcal += Number(f.kcal ?? 0);
      m.p += Number(f.protein_g ?? 0);
      m.c += Number(f.carbs_g ?? 0);
      m.f += Number(f.fat_g ?? 0);
      dayMap.set(day, m);
    });
    const loggedDays = dayMap.size;
    const avg = (k: "kcal" | "p" | "c" | "f") => {
      if (!loggedDays) return 0;
      let s = 0;
      dayMap.forEach((v) => (s += v[k]));
      return Math.round(s / loggedDays);
    };

    const weights = (weightsRes.data ?? []) as Array<{ log_date: string; weight_kg: number }>;
    const weightTrend =
      weights.length >= 2
        ? Number((weights[0].weight_kg - weights[weights.length - 1].weight_kg).toFixed(2))
        : null;
    const trendDays =
      weights.length >= 2
        ? Math.max(
            1,
            Math.round(
              (new Date(weights[0].log_date).getTime() -
                new Date(weights[weights.length - 1].log_date).getTime()) /
                86400000,
            ),
          )
        : null;

    const checkins = (checkinsRes.data ?? []) as any[];
    const avgNum = (key: string) => {
      const xs = checkins.map((c) => Number(c?.[key])).filter((n) => Number.isFinite(n));
      return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
    };

    const dataPackage = {
      profile: profileRes.data,
      current_targets: targetsRes.data,
      checkins_last_4: {
        count: checkins.length,
        avg_training_adherence: avgNum("training_adherence"),
        avg_nutrition_adherence: avgNum("nutrition_adherence"),
        avg_energy: avgNum("energy"),
        avg_sleep_quality: avgNum("sleep_quality"),
        recent_struggles: checkins
          .map((c) => c?.struggles)
          .filter((s) => typeof s === "string" && s.trim().length > 0)
          .slice(0, 4),
      },
      weight: {
        latest_kg: weights[0]?.weight_kg ?? null,
        change_kg: weightTrend,
        over_days: trendDays,
        samples: weights.length,
        change_pct_per_week:
          weightTrend != null && trendDays && weights[0]?.weight_kg
            ? Number(
                ((weightTrend / Number(weights[0].weight_kg)) * (7 / trendDays) * 100).toFixed(2),
              )
            : null,
      },
      nutrition_intake_14d: {
        logged_days: loggedDays,
        avg_kcal: avg("kcal"),
        avg_protein_g: avg("p"),
        avg_carbs_g: avg("c"),
        avg_fat_g: avg("f"),
        target_vs_actual_kcal:
          targetsRes.data?.kcal && loggedDays ? avg("kcal") - Number(targetsRes.data.kcal) : null,
      },
      training_14d: {
        sessions: (sessionsRes.data ?? []).length,
        completed: (sessionsRes.data ?? []).filter((s: any) => s.status === "completed").length,
        completion_rate:
          (sessionsRes.data ?? []).length > 0
            ? Number(
                (
                  (sessionsRes.data ?? []).filter((s: any) => s.status === "completed").length /
                  (sessionsRes.data ?? []).length
                ).toFixed(2),
              )
            : null,
      },
    };

    const system =
      "Du bist Senior-Coach-Assistent für BODYFUEL. Du schlägst datenbasierte Anpassungen vor und lieferst IMMER zwei Varianten: 'Konservativ' (kleine, sichere Änderungen) und 'Aggressiv' (deutlich größere Änderungen für schnellere Ergebnisse, akzeptiert mehr Risiko). Du nennst Konfidenz pro Variante und Warnungen, wenn die Datenlage dünn ist.";

    const prompt = `Generiere ZWEI Plan-Anpassungs-Varianten für denselben Kunden.

KUNDENDATEN (JSON):
${JSON.stringify(dataPackage, null, 2)}

ALLGEMEINE REGELN:
- Wenn nutrition_intake_14d.logged_days < 5 → confidence höchstens "low" + Warnung "Zu wenig Tracking-Tage".
- Bei Gewichtsplateau (|change_pct_per_week| < 0.2) im Cut → kcal runter ODER Cardio/NEAT.
- Bei Gewichtsverlust > 1%/Woche → kcal anheben (Muskelverlust-Risiko).
- Protein: ~1.8–2.2 g/kg im Cut, ~1.6–2.0 im Aufbau.
- Bei completion_rate < 0.6 → Volumen reduzieren oder Frequenz anpassen, NICHT erhöhen.
- Bei avg_energy < 5 oder avg_sleep_quality < 5 → Deload oder kcal-Reserve berücksichtigen.
- Wenn current_targets fehlt: nutrition=null + Warnung.
- training pro Variante: 0–3 priorisierte Vorschläge.

VARIANTEN-UNTERSCHIED:
- Konservativ: kcal-Änderung ±50–150, max +1/-1 Satz Volumen, vorsichtige Sprache.
- Aggressiv: kcal-Änderung ±200–400, ±2 Sätze Volumen oder Deload, klarere Maßnahmen — aber innerhalb sicherer Grenzen (Protein nicht unter 1.6 g/kg, kcal nicht unter BMR*1.1).

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{
  "variants": [
    {
      "label": "Konservativ",
      "summary": "string (1–2 Sätze)",
      "confidence": "high" | "medium" | "low",
      "nutrition": null | { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "rationale": "string" },
      "training": [ { "area": "volume"|"intensity"|"frequency"|"exercise_swap"|"deload", "detail": "string", "rationale": "string" } ],
      "warnings": ["string"]
    },
    {
      "label": "Aggressiv",
      "summary": "...",
      "confidence": "...",
      "nutrition": ...,
      "training": [...],
      "warnings": [...]
    }
  ]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
    if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden.");
    }

    const normalizeVariant = (v: any, fallbackLabel: "Konservativ" | "Aggressiv"): PlanAdjustmentVariant => ({
      label:
        v?.label === "Konservativ" || v?.label === "Aggressiv" ? v.label : fallbackLabel,
      summary: typeof v?.summary === "string" ? v.summary : "",
      confidence: (["high", "medium", "low"].includes(v?.confidence) ? v.confidence : "low") as
        | "high"
        | "medium"
        | "low",
      nutrition:
        v?.nutrition && typeof v.nutrition === "object"
          ? {
              kcal: Math.round(Number(v.nutrition.kcal ?? 0)),
              protein_g: Math.round(Number(v.nutrition.protein_g ?? 0)),
              carbs_g: Math.round(Number(v.nutrition.carbs_g ?? 0)),
              fat_g: Math.round(Number(v.nutrition.fat_g ?? 0)),
              rationale: String(v.nutrition.rationale ?? ""),
            }
          : null,
      training: Array.isArray(v?.training)
        ? v.training.slice(0, 5).map((t: any) => ({
            area: (["volume", "intensity", "frequency", "exercise_swap", "deload"].includes(t?.area)
              ? t.area
              : "volume") as TrainingAdjustment["area"],
            detail: String(t?.detail ?? ""),
            rationale: String(t?.rationale ?? ""),
          }))
        : [],
      warnings: Array.isArray(v?.warnings) ? v.warnings.slice(0, 6).map((w: any) => String(w)) : [],
    });

    const rawVariants = Array.isArray(parsed?.variants) ? parsed.variants : [];
    const variants: PlanAdjustmentVariant[] = [
      normalizeVariant(rawVariants[0] ?? {}, "Konservativ"),
      normalizeVariant(rawVariants[1] ?? {}, "Aggressiv"),
    ];

    return { current: targetsRes.data, variants };
  });

export const applyNutritionAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      rationale?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = context.supabase as any;
    await assertCoach(supabase, userId);

    const { data: before } = await supabase
      .from("nutrition_targets")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const patch = {
      user_id: data.user_id,
      kcal: Math.max(800, Math.min(6000, Math.round(data.kcal))),
      protein_g: Math.max(0, Math.round(data.protein_g)),
      carbs_g: Math.max(0, Math.round(data.carbs_g)),
      fat_g: Math.max(0, Math.round(data.fat_g)),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("nutrition_targets")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    await supabase.from("plan_adjustment_history").insert({
      client_id: data.user_id,
      coach_id: userId,
      kind: "nutrition",
      area: "macros",
      summary: `kcal ${patch.kcal} · P${patch.protein_g}/C${patch.carbs_g}/F${patch.fat_g}`,
      before_json: before ?? null,
      after_json: { kcal: patch.kcal, protein_g: patch.protein_g, carbs_g: patch.carbs_g, fat_g: patch.fat_g },
      rationale: data.rationale ?? null,
    });

    return { ok: true };
  });

export type TrainingApplyAction =
  | { type: "volume_delta"; sets_delta: number; detail: string; rationale?: string }
  | { type: "deload"; scale: number; detail: string; rationale?: string }
  | { type: "note"; area: string; detail: string; rationale?: string };

export const applyTrainingAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; action: TrainingApplyAction }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = context.supabase as any;
    await assertCoach(supabase, userId);
    const action = data.action;

    const { data: plan } = await supabase
      .from("training_plans")
      .select("id")
      .eq("client_id", data.user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!plan) throw new Error("Kein aktiver Trainingsplan gefunden.");

    const { data: days } = await supabase
      .from("training_days")
      .select("id")
      .eq("plan_id", plan.id);
    const dayIds = (days ?? []).map((d: any) => d.id);

    let summary = "";
    let beforeSnapshot: any = null;
    let afterSnapshot: any = null;

    if (action.type === "volume_delta" && dayIds.length > 0) {
      const { data: exs } = await supabase
        .from("training_exercises")
        .select("id, name, target_sets")
        .in("day_id", dayIds);
      const updates = (exs ?? []).map((e: any) => ({
        id: e.id,
        next: Math.max(1, Math.min(8, (e.target_sets ?? 3) + action.sets_delta)),
        prev: e.target_sets ?? 3,
      }));
      for (const u of updates) {
        await supabase.from("training_exercises").update({ target_sets: u.next }).eq("id", u.id);
      }
      beforeSnapshot = { exercises: (exs ?? []).map((e: any) => ({ name: e.name, sets: e.target_sets })) };
      afterSnapshot = { sets_delta: action.sets_delta, affected: updates.length };
      summary = `Volumen ${action.sets_delta > 0 ? "+" : ""}${action.sets_delta} Sätze auf ${updates.length} Übungen`;
    } else if (action.type === "deload" && dayIds.length > 0) {
      const scale = Math.max(0.4, Math.min(0.9, action.scale));
      const { data: exs } = await supabase
        .from("training_exercises")
        .select("id, name, target_sets")
        .in("day_id", dayIds);
      const updates = (exs ?? []).map((e: any) => ({
        id: e.id,
        next: Math.max(1, Math.round((e.target_sets ?? 3) * scale)),
      }));
      for (const u of updates) {
        await supabase.from("training_exercises").update({ target_sets: u.next }).eq("id", u.id);
      }
      beforeSnapshot = { exercises: (exs ?? []).map((e: any) => ({ name: e.name, sets: e.target_sets })) };
      afterSnapshot = { scale, affected: updates.length };
      summary = `Deload-Woche: Sätze × ${scale.toFixed(2)} (${updates.length} Übungen)`;
    } else {
      summary = action.detail;
    }

    await supabase.from("plan_adjustment_history").insert({
      client_id: data.user_id,
      coach_id: userId,
      kind: "training",
      area: action.type,
      summary,
      before_json: beforeSnapshot,
      after_json: afterSnapshot,
      rationale: action.rationale ?? null,
    });

    return { ok: true, summary };
  });

export const listPlanAdjustmentHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = context.supabase as any;
    await assertCoach(supabase, userId);
    const { data: rows, error } = await supabase
      .from("plan_adjustment_history")
      .select("id, kind, area, summary, rationale, created_at, before_json, after_json")
      .eq("client_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(Math.min(50, data.limit ?? 20));
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as any[] };
  });

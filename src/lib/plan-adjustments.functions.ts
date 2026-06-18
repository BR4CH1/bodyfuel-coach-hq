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

export const generatePlanAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }): Promise<PlanAdjustmentSuggestion & { current: any }> => {
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
      const day = String(f.logged_at).slice(0, 10);
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

    const dataPackage = {
      profile: profileRes.data,
      current_targets: targetsRes.data,
      checkins: checkinsRes.data ?? [],
      weight: {
        latest_kg: weights[0]?.weight_kg ?? null,
        change_kg: weightTrend,
        over_days: trendDays,
        samples: weights.length,
      },
      nutrition_intake_14d: {
        logged_days: loggedDays,
        avg_kcal: avg("kcal"),
        avg_protein_g: avg("p"),
        avg_carbs_g: avg("c"),
        avg_fat_g: avg("f"),
      },
      training_14d: {
        sessions: (sessionsRes.data ?? []).length,
        completed: (sessionsRes.data ?? []).filter((s: any) => s.status === "completed").length,
      },
    };

    const system =
      "Du bist Senior-Coach-Assistent für BODYFUEL. Du schlägst konkrete, datenbasierte Anpassungen für Ernährungs- und Trainingsplan vor. Du bist konservativ: kcal-Änderungen typisch ±100–250 kcal, Protein in g/kg-Logik. Du nennst eine Konfidenz und Warnungen, wenn die Datenlage dünn ist.";

    const prompt = `Schlage Plan-Anpassungen vor.

KUNDENDATEN (JSON):
${JSON.stringify(dataPackage, null, 2)}

REGELN:
- Wenn nutrition_intake_14d.logged_days < 5 → confidence höchstens "low" und entsprechende Warnung.
- Bei Gewichtsplateau (|change_kg| < 0.3 in 14+ Tagen) bei Cut → 100–200 kcal runter ODER Cardio/NEAT-Empfehlung im Training.
- Bei Gewichtsverlust > 1% Körpergewicht/Woche → kcal anheben.
- Protein-Empfehlung: ~1.8–2.2 g/kg Körpergewicht im Cut, ~1.6–2.0 im Aufbau.
- Wenn current_targets fehlt: nutrition = null und Warnung.
- training: 0–3 priorisierte Vorschläge.

Antworte AUSSCHLIESSLICH mit gültigem JSON in genau dieser Form:
{
  "summary": "string (1–2 Sätze)",
  "confidence": "high" | "medium" | "low",
  "nutrition": null | {
    "kcal": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "rationale": "string (1–2 Sätze, warum diese Zahlen)"
  },
  "training": [
    {
      "area": "volume" | "intensity" | "frequency" | "exercise_swap" | "deload",
      "detail": "string (konkrete Aktion)",
      "rationale": "string (warum)"
    }
  ],
  "warnings": ["string", ...]
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

    const result: PlanAdjustmentSuggestion = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      confidence: (["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "low") as "high" | "medium" | "low",
      nutrition:
        parsed.nutrition && typeof parsed.nutrition === "object"
          ? {
              kcal: Math.round(Number(parsed.nutrition.kcal ?? 0)),
              protein_g: Math.round(Number(parsed.nutrition.protein_g ?? 0)),
              carbs_g: Math.round(Number(parsed.nutrition.carbs_g ?? 0)),
              fat_g: Math.round(Number(parsed.nutrition.fat_g ?? 0)),
              rationale: String(parsed.nutrition.rationale ?? ""),
            }
          : null,
      training: Array.isArray(parsed.training)
        ? parsed.training.slice(0, 5).map((t: any) => ({
            area: (["volume", "intensity", "frequency", "exercise_swap", "deload"].includes(t?.area)
              ? t.area
              : "volume") as TrainingAdjustment["area"],
            detail: String(t?.detail ?? ""),
            rationale: String(t?.rationale ?? ""),
          }))
        : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 6).map((w: any) => String(w)) : [],
    };

    return { ...result, current: targetsRes.data };
  });

export const applyNutritionAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { user_id: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);

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
    return { ok: true };
  });

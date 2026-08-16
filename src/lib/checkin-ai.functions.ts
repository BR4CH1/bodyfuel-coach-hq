import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(supabase: any, userId: string) {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Forbidden — Coach-Rolle erforderlich");
}

type DraftAction = {
  area: "nutrition" | "training" | "lifestyle" | "communication";
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type CheckinDraft = {
  status_summary: string;
  status_level: "green" | "yellow" | "red";
  wins: string[];
  concerns: string[];
  recommended_actions: DraftAction[];
  coach_message: string;
  nutrition_adjustment: string | null;
  training_adjustment: string | null;
};

export const generateCheckinDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const target = data.user_id;
    const today = new Date();
    const since14 = new Date(today.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const since30 = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "display_name, gender, height_cm, goal_weight_kg, coaching_goal, training_goal, activity_level, birthdate",
      )
      .eq("id", target)
      .maybeSingle();

    // Letzte Check-ins
    const { data: checkins } = await supabase
      .from("weekly_checkins")
      .select(
        "week_start, weight_kg, body_fat_pct, waist_cm, mood, energy, sleep_quality, training_adherence, nutrition_adherence, wins, struggles",
      )
      .eq("user_id", target)
      .order("week_start", { ascending: false })
      .limit(6);

    // Gewichtsverlauf
    const { data: weights } = await supabase
      .from("body_measurements")
      .select("measured_at, weight_kg")
      .eq("user_id", target)
      .not("weight_kg", "is", null)
      .gte("measured_at", since30)
      .order("measured_at", { ascending: false })
      .limit(30);

    // Aktuell tatsächlich gültige Ziele (aktiver Plan vor Fallback-Tabelle).
    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");
    const targets = await loadEffectiveNutritionTargets(
      supabase,
      target,
      today.toISOString().slice(0, 10),
    );

    // Letzte 14 Tage Food-Logs zusammengefasst
    const { data: foods } = await supabase
      .from("food_entries")
      .select("entry_date, kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", target)
      .gte("entry_date", since14);

    const dayMap = new Map<string, { kcal: number; p: number; c: number; f: number }>();
    (foods ?? []).forEach((f: any) => {
      const day = String(f.entry_date).slice(0, 10);
      const m = dayMap.get(day) ?? { kcal: 0, p: 0, c: 0, f: 0 };
      m.kcal += Number(f.kcal ?? 0);
      m.p += Number(f.protein_g ?? 0);
      m.c += Number(f.carbs_g ?? 0);
      m.f += Number(f.fat_g ?? 0);
      dayMap.set(day, m);
    });
    const loggedDays = dayMap.size;
    const avg = (key: "kcal" | "p" | "c" | "f") => {
      if (!loggedDays) return 0;
      let s = 0;
      dayMap.forEach((v) => (s += v[key]));
      return Math.round(s / loggedDays);
    };
    const nutritionSummary = {
      logged_days_14d: loggedDays,
      avg_kcal: avg("kcal"),
      avg_protein_g: avg("p"),
      avg_carbs_g: avg("c"),
      avg_fat_g: avg("f"),
      target_kcal: targets?.kcal ?? null,
      target_protein_g: targets?.protein_g ?? null,
    };

    // Training (Sessions letzte 14 Tage)
    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("session_date, status")
      .eq("client_id", target)
      .gte("session_date", since14);
    const trainingSummary = {
      sessions_14d: (sessions ?? []).length,
      completed_14d: (sessions ?? []).filter((s: any) => s.status === "completed").length,
    };

    const dataPackage = {
      profile: { ...profile, current_weight_kg: weights?.[0]?.weight_kg ?? null },
      checkins: checkins ?? [],
      weight_logs: weights ?? [],
      nutrition: nutritionSummary,
      training: trainingSummary,
    };

    const system =
      "Du bist Senior-Coach-Assistent für BODYFUEL. Du analysierst Kundendaten und erstellst einen kompakten, fachlich fundierten Check-in-Entwurf auf Deutsch. Du sprichst den Kunden IMMER direkt in der Du-Form an (nicht in dritter Person, keine unpersönlichen Formulierungen wie 'der Kunde' oder 'die Zufuhr muss'). Alle Texte — Status, Wins, Concerns, Aktionen und Nachricht — sind direkt an den Kunden gerichtet ('Du hast...', 'Deine Kalorien...', 'Erhöhe deine Zufuhr...'). Der Coach entscheidet final, welche Punkte veröffentlicht werden.";

    const prompt = `Erstelle einen Check-in-Entwurf für diesen Kunden. Sprich den Kunden durchgehend mit "Du" an.

KUNDENDATEN (JSON):
${JSON.stringify(dataPackage, null, 2)}

AUFGABE:
1. Bewerte den aktuellen Status (green = auf Kurs, yellow = beobachten, red = Handlungsbedarf). status_summary in Du-Form.
2. Liste 2–4 Wins in Du-Form ("Du hast...", "Dein Schlaf...").
3. Liste 1–3 Concerns in Du-Form ("Du liegst deutlich unter...", "Dein Proteinkonsum...").
4. Empfiehl 2–5 konkrete Aktionen (priorisiert). title und detail als DIREKTE Anweisung an den Kunden in Du-Form ("Erhöhe deine Kalorienzufuhr sofort", "Nimm zu jeder Mahlzeit eine Proteinquelle...").
5. Formuliere eine kurze, persönliche Nachricht an den Kunden (max. 4 Sätze, Du-Form, motivierend aber ehrlich).
6. Wenn sinnvoll: konkreter Vorschlag für Ernährungs-/Trainingsanpassung in Du-Form (sonst null).

WICHTIG: KEIN Text darf in dritter Person ("der Athlet", "der Kunde", "die Zufuhr muss") verfasst sein. Immer direkte Ansprache.

Antworte AUSSCHLIESSLICH mit gültigem JSON in genau dieser Form:
{
  "status_summary": "string (1–2 Sätze)",
  "status_level": "green" | "yellow" | "red",
  "wins": ["string", ...],
  "concerns": ["string", ...],
  "recommended_actions": [
    {"area":"nutrition|training|lifestyle|communication","title":"string","detail":"string","priority":"high|medium|low"}
  ],
  "coach_message": "string",
  "nutrition_adjustment": "string oder null",
  "training_adjustment": "string oder null"
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
    if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: CheckinDraft;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Antwort konnte nicht gelesen werden.");
    }

    // Defensive defaults
    const draft: CheckinDraft = {
      status_summary: parsed.status_summary ?? "",
      status_level: (["green", "yellow", "red"].includes(parsed.status_level as string)
        ? parsed.status_level
        : "yellow") as CheckinDraft["status_level"],
      wins: Array.isArray(parsed.wins) ? parsed.wins.slice(0, 6) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 6) : [],
      recommended_actions: Array.isArray(parsed.recommended_actions)
        ? parsed.recommended_actions.slice(0, 8)
        : [],
      coach_message: parsed.coach_message ?? "",
      nutrition_adjustment: parsed.nutrition_adjustment ?? null,
      training_adjustment: parsed.training_adjustment ?? null,
    };

    // Persist as pending draft
    const { data: saved, error: saveErr } = await supabase
      .from("ai_checkin_drafts")
      .insert({
        client_id: target,
        coach_id: userId,
        status: "pending",
        draft: draft as any,
        message_final: draft.coach_message,
      })
      .select("id, generated_at")
      .single();
    if (saveErr) throw new Error(`Entwurf konnte nicht gespeichert werden: ${saveErr.message}`);

    return {
      id: saved.id as string,
      draft,
      generated_at: saved.generated_at as string,
      status: "pending" as const,
      message_final: draft.coach_message,
    };
  });

export type ActionDecision = {
  index: number;
  decision: "approved" | "rejected";
};

export type CheckinDraftRecord = {
  id: string;
  client_id: string;
  coach_id: string;
  status: "pending" | "approved" | "edited" | "rejected";
  draft: CheckinDraft;
  message_final: string | null;
  generated_at: string;
  decided_at: string | null;
  action_decisions: ActionDecision[];
  published_at: string | null;
};

export const listCheckinDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; limit?: number }) => d)
  .handler(async ({ data, context }): Promise<{ items: CheckinDraftRecord[] }> => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { data: rows, error } = await supabase
      .from("ai_checkin_drafts")
      .select("id, client_id, coach_id, status, draft, message_final, generated_at, decided_at, action_decisions, published_at")
      .eq("client_id", data.user_id)
      .order("generated_at", { ascending: false })
      .limit(Math.min(50, data.limit ?? 10));
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as CheckinDraftRecord[] };
  });

export const decideCheckinDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      draft_id: string;
      decision: "approved" | "edited" | "rejected";
      message_final?: string;
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const patch: {
      status: "approved" | "edited" | "rejected";
      decided_at: string;
      message_final?: string;
      published_at?: string | null;
    } = {
      status: data.decision,
      decided_at: new Date().toISOString(),
    };
    if (typeof data.message_final === "string") {
      patch.message_final = data.message_final;
    }
    if (data.decision === "rejected") {
      patch.published_at = null;
    } else if (data.publish) {
      patch.published_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("ai_checkin_drafts")
      .update(patch)
      .eq("id", data.draft_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCheckinDraftActionDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      draft_id: string;
      action_index: number;
      decision: "approved" | "rejected" | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { data: row, error: readErr } = await supabase
      .from("ai_checkin_drafts")
      .select("action_decisions")
      .eq("id", data.draft_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const current: ActionDecision[] = Array.isArray((row as any)?.action_decisions)
      ? ((row as any).action_decisions as ActionDecision[])
      : [];
    const next = current.filter((a) => a.index !== data.action_index);
    if (data.decision) {
      next.push({ index: data.action_index, decision: data.decision });
    }
    const { error } = await supabase
      .from("ai_checkin_drafts")
      .update({ action_decisions: next })
      .eq("id", data.draft_id);
    if (error) throw new Error(error.message);
    return { ok: true, action_decisions: next };
  });

export const deleteCheckinDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draft_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { error } = await supabase
      .from("ai_checkin_drafts")
      .delete()
      .eq("id", data.draft_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ClientPublishedCheckin = {
  id: string;
  published_at: string;
  message_final: string | null;
  status_summary: string;
  status_level: "green" | "yellow" | "red";
  approved_actions: DraftAction[];
  nutrition_adjustment: string | null;
  training_adjustment: string | null;
};

export const getPublishedCheckinForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ item: ClientPublishedCheckin | null }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ai_checkin_drafts")
      .select("id, draft, message_final, published_at, action_decisions, status")
      .eq("client_id", userId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as any;
    if (!row) return { item: null };
    const draft = row.draft as CheckinDraft;
    const decisions = (row.action_decisions ?? []) as ActionDecision[];
    const approved = new Set(
      decisions.filter((d) => d.decision === "approved").map((d) => d.index),
    );
    // Wenn keine explizite Entscheidung: bei publish nehmen wir an, alle Aktionen sind mit-freigegeben.
    const hasAnyDecision = decisions.length > 0;
    const approvedActions = (draft.recommended_actions ?? []).filter(
      (_, i) => (hasAnyDecision ? approved.has(i) : true),
    );
    return {
      item: {
        id: row.id,
        published_at: row.published_at,
        message_final: row.message_final,
        status_summary: draft.status_summary,
        status_level: draft.status_level,
        approved_actions: approvedActions,
        nutrition_adjustment: draft.nutrition_adjustment,
        training_adjustment: draft.training_adjustment,
      },
    };
  });


export type PendingDraftRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  status_level: "green" | "yellow" | "red";
  status_summary: string;
  generated_at: string;
};

export const listPendingDraftsForCoach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: PendingDraftRow[] }> => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { data: rows, error } = await supabase
      .from("ai_checkin_drafts")
      .select("id, client_id, draft, generated_at")
      .eq("status", "pending")
      .order("generated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const clientIds = Array.from(new Set((rows ?? []).map((r: any) => r.client_id)));
    const nameMap = new Map<string, string>();
    if (clientIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", clientIds);
      (profs ?? []).forEach((p: any) => {
        if (p.display_name) nameMap.set(p.id, p.display_name);
      });
    }
    const items: PendingDraftRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      client_id: r.client_id,
      client_name: nameMap.get(r.client_id) ?? null,
      status_level: r.draft?.status_level ?? "yellow",
      status_summary: r.draft?.status_summary ?? "",
      generated_at: r.generated_at,
    }));
    return { items };
  });


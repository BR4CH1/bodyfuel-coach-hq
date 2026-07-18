/**
 * Fuely Tools — serverseitige Datenzugriffe, die der KI-Coach als
 * OpenAI-kompatible "function tools" aufrufen kann. Alle Queries laufen
 * über den authentifizierten Supabase-Client (RLS greift).
 *
 * Server-only Datei (`.server.ts`), nicht ins Client-Bundle importieren.
 */

import {
  insertTimelineEvent,
  detectWeightMilestone,
  detectProteinGoalMilestone,
  type TimelineEventInput,
} from "./fuely-timeline.server";

type SB = any; // typed as any to avoid heavy type gymnastics; RLS enforced

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function emitTimeline(
  supabase: SB,
  userId: string,
  event: TimelineEventInput,
): Promise<void> {
  try {
    await insertTimelineEvent(supabase, userId, event);
  } catch {
    /* nie den Tool-Call blocken */
  }
}

/** OpenAI-Tools-Definition, wird an das Gateway geschickt. */
export const FUELY_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_profile",
      description:
        "Grunddaten des Nutzers: Name, Geschlecht, Größe, aktuelles/Zielgewicht, Ziel, Aktivitätslevel, Geburtsdatum.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_nutrition",
      description:
        "Heutige Ernährung: Tagesziel (Kcal, Protein, Kohlenhydrate, Fett, Wasser) + bereits gegessen + noch offen.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nutrition_history",
      description: "Ernährungshistorie der letzten N Tage (Summen pro Tag).",
      parameters: {
        type: "object",
        properties: { days: { type: "integer", minimum: 1, maximum: 60, default: 7 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_training",
      description: "Heute geplantes/erledigtes Training des Nutzers.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_training_history",
      description: "Trainingshistorie der letzten N Wochen (Anzahl, Volumen, Status).",
      parameters: {
        type: "object",
        properties: { weeks: { type: "integer", minimum: 1, maximum: 16, default: 4 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_measurements",
      description: "Körpermaße (Gewicht, KFA, Umfänge) der letzten N Tage.",
      parameters: {
        type: "object",
        properties: { days: { type: "integer", minimum: 7, maximum: 365, default: 60 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_checkins",
      description: "Letzte Athlete- und Weekly-Check-ins (Mood, Schlaf, Energie).",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 30, default: 10 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_streak_xp",
      description: "Aktuelle Streak, XP, Level und Wochenpunkte.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_challenges",
      description: "Aktive Organisationschallenges + persönlicher Fortschritt.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_coach_messages",
      description: "Neueste Nachrichten vom Coach (max 5).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_memory",
      description: "Langzeit-Memory (was Fuely über den Nutzer weiß).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description:
        "Zeigt dem Nutzer einen In-App-Link an. Nutze das, wenn du auf einen bestimmten Bereich verweist (Training, Ernährung, Check-in, Community, Profil).",
      parameters: {
        type: "object",
        required: ["path", "label"],
        properties: {
          path: {
            type: "string",
            description:
              "Relativer Pfad, z.B. '/{orgSlug}/training', '/{orgSlug}/nutrition', '/{orgSlug}/checkin', '/{orgSlug}/community'. {orgSlug} wird serverseitig ersetzt.",
          },
          label: { type: "string", description: "Kurzer Button-Text, z.B. 'Zum Training'." },
        },
      },
    },
  },
  // ============ WRITE / ACTION TOOLS ============
  {
    type: "function",
    function: {
      name: "log_water",
      description:
        "Trägt Wasser für den heutigen Tag ein. Entweder in Millilitern (ml) ODER in Gläsern (glasses). 1 Glas = 250 ml.",
      parameters: {
        type: "object",
        properties: {
          ml: { type: "integer", minimum: 50, maximum: 5000 },
          glasses: { type: "integer", minimum: 1, maximum: 30 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_weight",
      description: "Speichert das aktuelle Gewicht des Nutzers (in kg).",
      parameters: {
        type: "object",
        required: ["weight_kg"],
        properties: {
          weight_kg: { type: "number", minimum: 20, maximum: 300 },
          note: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_measurement",
      description:
        "Speichert einzelne Körpermaße (Taille, Hüfte, Brust, Oberschenkel, Bizeps, KFA). Nur ausfüllen, was der Nutzer nennt.",
      parameters: {
        type: "object",
        properties: {
          waist_cm: { type: "number", minimum: 30, maximum: 200 },
          hip_cm: { type: "number", minimum: 30, maximum: 200 },
          chest_cm: { type: "number", minimum: 30, maximum: 200 },
          thigh_left_cm: { type: "number", minimum: 20, maximum: 120 },
          thigh_right_cm: { type: "number", minimum: 20, maximum: 120 },
          biceps_left_cm: { type: "number", minimum: 15, maximum: 80 },
          biceps_right_cm: { type: "number", minimum: 15, maximum: 80 },
          body_fat_pct: { type: "number", minimum: 3, maximum: 60 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_food_entry",
      description:
        "Fügt einen Lebensmittel-/Mahlzeitenrecord für heute hinzu. Nutze das für Ad-hoc-Einträge, wenn der Nutzer konkret sagt was er gegessen hat.",
      parameters: {
        type: "object",
        required: ["name", "meal", "kcal"],
        properties: {
          name: { type: "string", description: "Kurzer Name, z.B. 'Magerquark 250g'" },
          meal: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "snack"],
          },
          serving_g: { type: "number", minimum: 1, maximum: 3000 },
          kcal: { type: "number", minimum: 0, maximum: 5000 },
          protein_g: { type: "number", minimum: 0, maximum: 300 },
          carbs_g: { type: "number", minimum: 0, maximum: 500 },
          fat_g: { type: "number", minimum: 0, maximum: 300 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_training",
      description:
        "Markiert das heutige (oder ein bestimmtes) Training als erledigt. Ohne 'session_id' wird das nächste offene Training verwendet.",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_training",
      description:
        "Verschiebt eine Trainingseinheit auf ein anderes Datum. Ohne 'session_id' wird die nächste geplante Einheit genommen.",
      parameters: {
        type: "object",
        required: ["new_date"],
        properties: {
          session_id: { type: "string" },
          new_date: { type: "string", description: "ISO-Datum YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last_action",
      description:
        "Macht die letzte durch Fuely ausgeführte Aktion rückgängig (nur innerhalb des Undo-Fensters).",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

// Aktionstypen, die eine explizite Nutzer-Bestätigung im Chat erfordern,
// BEVOR sie ausgeführt werden. Fuely soll dann erst zusammenfassen und fragen.
export const HIGH_RISK_ACTIONS = new Set<string>([
  "replace_nutrition_plan",
  "replace_training_plan",
  "change_calorie_target",
  "bulk_delete_entries",
  "override_coach_setting",
]);


export type ToolCall = { id: string; name: string; args: any };

/** Führt einen Tool-Call aus und liefert ein kompaktes JSON-Result zurück. */
export async function runFuelyTool(
  supabase: SB,
  userId: string,
  orgSlug: string | null,
  call: ToolCall,
): Promise<any> {
  const { name, args } = call;
  try {
    switch (name) {
      case "get_profile": {
        const { data } = await supabase
          .from("profiles")
          .select(
            "display_name, first_name, gender, height_cm, current_weight_kg, target_weight_kg, goal, activity_level, birthdate",
          )
          .eq("id", userId)
          .maybeSingle();
        return data ?? {};
      }
      case "get_today_nutrition": {
        const today = isoDay();
        const [{ data: t }, { data: entries }, { data: water }] = await Promise.all([
          supabase
            .from("nutrition_targets")
            .select("kcal, protein_g, carbs_g, fat_g, water_glasses")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("food_entries")
            .select("kcal, protein_g, carbs_g, fat_g")
            .eq("user_id", userId)
            .eq("entry_date", today),
          supabase
            .from("water_logs")
            .select("glasses")
            .eq("user_id", userId)
            .eq("entry_date", today)
            .maybeSingle(),
        ]);
        const eaten = (entries ?? []).reduce(
          (a: any, r: any) => ({
            kcal: a.kcal + Number(r.kcal ?? 0),
            protein_g: a.protein_g + Number(r.protein_g ?? 0),
            carbs_g: a.carbs_g + Number(r.carbs_g ?? 0),
            fat_g: a.fat_g + Number(r.fat_g ?? 0),
          }),
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        );
        return {
          date: today,
          target: t ?? null,
          eaten,
          water_glasses: Number((water as any)?.glasses ?? 0),
          open: t
            ? {
                kcal: Math.max(0, Number(t.kcal) - eaten.kcal),
                protein_g: Math.max(0, Number(t.protein_g) - eaten.protein_g),
                water_glasses: Math.max(0, Number(t.water_glasses ?? 0) - Number((water as any)?.glasses ?? 0)),
              }
            : null,
        };
      }
      case "get_nutrition_history": {
        const days = Math.min(60, Math.max(1, Number(args?.days ?? 7)));
        const from = isoDay(-days + 1);
        const { data } = await supabase
          .from("food_entries")
          .select("entry_date, kcal, protein_g, carbs_g, fat_g")
          .eq("user_id", userId)
          .gte("entry_date", from);
        const byDay = new Map<string, any>();
        (data ?? []).forEach((r: any) => {
          const d = r.entry_date;
          const cur = byDay.get(d) ?? { date: d, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
          cur.kcal += Number(r.kcal ?? 0);
          cur.protein_g += Number(r.protein_g ?? 0);
          cur.carbs_g += Number(r.carbs_g ?? 0);
          cur.fat_g += Number(r.fat_g ?? 0);
          byDay.set(d, cur);
        });
        return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
      }
      case "get_today_training": {
        const today = isoDay();
        const { data } = await supabase
          .from("training_sessions")
          .select("id, status, session_date, completed_at, focus, notes")
          .eq("client_id", userId)
          .eq("session_date", today);
        return data ?? [];
      }
      case "get_training_history": {
        const weeks = Math.min(16, Math.max(1, Number(args?.weeks ?? 4)));
        const from = isoDay(-weeks * 7);
        const { data } = await supabase
          .from("training_sessions")
          .select("session_date, status, completed_at, focus")
          .eq("client_id", userId)
          .gte("session_date", from)
          .order("session_date", { ascending: false })
          .limit(80);
        return data ?? [];
      }
      case "get_measurements": {
        const days = Math.min(365, Math.max(7, Number(args?.days ?? 60)));
        const from = isoDay(-days);
        const { data } = await supabase
          .from("body_measurements")
          .select("measured_at, weight_kg, body_fat_percent, waist_cm, hip_cm, chest_cm")
          .eq("user_id", userId)
          .gte("measured_at", from)
          .order("measured_at", { ascending: false })
          .limit(60);
        return data ?? [];
      }
      case "get_checkins": {
        const limit = Math.min(30, Math.max(1, Number(args?.limit ?? 10)));
        const [{ data: athlete }, { data: weekly }] = await Promise.all([
          supabase
            .from("athlete_checkins")
            .select("created_at, mood, energy, sleep_hours, notes")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("weekly_checkins")
            .select("created_at, week_start, energy, motivation, sleep_quality, notes")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);
        return { athlete: athlete ?? [], weekly: weekly ?? [] };
      }
      case "get_streak_xp": {
        const { data } = await supabase
          .from("user_points")
          .select("current_streak, longest_streak, total_points, level, weekly_points")
          .eq("user_id", userId)
          .maybeSingle();
        return data ?? {};
      }
      case "get_challenges": {
        const { data: challenges } = await supabase
          .from("organization_challenges")
          .select("id, title, description, starts_at, ends_at, target_value, unit")
          .gte("ends_at", isoDay())
          .order("ends_at", { ascending: true })
          .limit(5);
        const ids = (challenges ?? []).map((c: any) => c.id);
        let progress: any[] = [];
        if (ids.length) {
          const { data: p } = await supabase
            .from("organization_challenge_progress")
            .select("challenge_id, current_value")
            .eq("user_id", userId)
            .in("challenge_id", ids);
          progress = p ?? [];
        }
        return { challenges: challenges ?? [], progress };
      }
      case "get_coach_messages": {
        const { data } = await supabase
          .from("coach_messages")
          .select("created_at, sender_id, content")
          .eq("client_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        return data ?? [];
      }
      case "get_memory": {
        const { data } = await supabase
          .from("fuely_memories")
          .select("category, content, importance")
          .eq("user_id", userId)
          .order("importance", { ascending: false })
          .limit(40);
        return data ?? [];
      }
      case "navigate_to": {
        const raw = String(args?.path ?? "");
        const path = orgSlug ? raw.replace(/\{orgSlug\}/g, orgSlug) : raw;
        return { path, label: String(args?.label ?? "Öffnen") };
      }

      // ============ WRITE ACTIONS ============
      case "log_water": {
        const glasses = args?.glasses
          ? Number(args.glasses)
          : Math.max(1, Math.round(Number(args?.ml ?? 0) / 250));
        if (!glasses) return { error: "Menge fehlt" };
        const today = isoDay();
        const { data: existing } = await supabase
          .from("water_logs")
          .select("glasses")
          .eq("user_id", userId)
          .eq("entry_date", today)
          .maybeSingle();
        const oldGlasses = Number((existing as any)?.glasses ?? 0);
        const newGlasses = oldGlasses + glasses;
        const { error } = await supabase
          .from("water_logs")
          .upsert({ user_id: userId, entry_date: today, glasses: newGlasses });
        if (error) return { error: error.message };
        const logId = await logAction(supabase, userId, {
          action_type: "log_water",
          target_table: "water_logs",
          target_id: `${userId}:${today}`,
          old_value: { glasses: oldGlasses },
          new_value: { glasses: newGlasses },
          summary: `+${glasses} Glas Wasser`,
          undo_minutes: 30,
        });
        await emitTimeline(supabase, userId, {
          event_type: "action",
          category: "water",
          icon: "💧",
          title: `${glasses * 250} ml Wasser eingetragen`,
          summary: `Heute insgesamt ${newGlasses} Glas`,
          coach_visible: true,
          metadata: { glasses_added: glasses, total_glasses: newGlasses },
        });
        return { done: true, added_glasses: glasses, total_glasses: newGlasses, log_id: logId };
      }

      case "log_weight": {
        const w = Number(args?.weight_kg);
        if (!(w >= 20 && w <= 300)) return { error: "Ungültiges Gewicht" };
        const today = isoDay();
        const { data: existing } = await supabase
          .from("body_measurements")
          .select("id, weight_kg")
          .eq("user_id", userId)
          .eq("measured_at", today)
          .maybeSingle();
        let newId = (existing as any)?.id as string | undefined;
        if (existing) {
          const { error } = await supabase
            .from("body_measurements")
            .update({ weight_kg: w, notes: args?.note ?? null })
            .eq("id", (existing as any).id);
          if (error) return { error: error.message };
        } else {
          const { data: ins, error } = await supabase
            .from("body_measurements")
            .insert({ user_id: userId, measured_at: today, weight_kg: w, notes: args?.note ?? null })
            .select("id")
            .single();
          if (error) return { error: error.message };
          newId = (ins as any).id;
        }
        const logId = await logAction(supabase, userId, {
          action_type: "log_weight",
          target_table: "body_measurements",
          target_id: newId ?? null,
          old_value: { weight_kg: (existing as any)?.weight_kg ?? null },
          new_value: { weight_kg: w },
          summary: `Gewicht: ${w} kg`,
          undo_minutes: 60,
        });
        await emitTimeline(supabase, userId, {
          event_type: "action",
          category: "weight",
          icon: "⚖️",
          title: `Gewicht: ${w.toFixed(1)} kg`,
          summary: null,
          coach_visible: true,
          metadata: { weight_kg: w },
        });
        const wMile = await detectWeightMilestone(supabase, userId, w);
        if (wMile) await emitTimeline(supabase, userId, wMile);
        return { done: true, weight_kg: w, log_id: logId };
      }

      case "log_measurement": {
        const fields = [
          "waist_cm",
          "hip_cm",
          "chest_cm",
          "thigh_left_cm",
          "thigh_right_cm",
          "biceps_left_cm",
          "biceps_right_cm",
          "body_fat_pct",
        ] as const;
        const payload: any = {};
        for (const f of fields) if (args?.[f] != null) payload[f] = Number(args[f]);
        if (!Object.keys(payload).length) return { error: "Keine Maße angegeben" };
        const today = isoDay();
        const { data: existing } = await supabase
          .from("body_measurements")
          .select("id, waist_cm, hip_cm, chest_cm, thigh_left_cm, thigh_right_cm, biceps_left_cm, biceps_right_cm, body_fat_pct")
          .eq("user_id", userId)
          .eq("measured_at", today)
          .maybeSingle();
        let newId = (existing as any)?.id as string | undefined;
        if (existing) {
          const { error } = await supabase
            .from("body_measurements")
            .update(payload)
            .eq("id", (existing as any).id);
          if (error) return { error: error.message };
        } else {
          const { data: ins, error } = await supabase
            .from("body_measurements")
            .insert({ user_id: userId, measured_at: today, ...payload })
            .select("id")
            .single();
          if (error) return { error: error.message };
          newId = (ins as any).id;
        }
        const logId = await logAction(supabase, userId, {
          action_type: "log_measurement",
          target_table: "body_measurements",
          target_id: newId ?? null,
          old_value: existing ?? null,
          new_value: payload,
          summary: `Maße aktualisiert`,
          undo_minutes: 60,
        });
        await emitTimeline(supabase, userId, {
          event_type: "action",
          category: "measurement",
          icon: "📏",
          title: "Körpermaße aktualisiert",
          summary: Object.entries(payload)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · "),
          coach_visible: true,
          metadata: payload,
        });
        return { done: true, saved: payload, log_id: logId };
      }

      case "add_food_entry": {
        const today = isoDay();
        const row = {
          user_id: userId,
          entry_date: today,
          meal: String(args?.meal ?? "snack"),
          name: String(args?.name ?? "").slice(0, 200),
          serving_g: Number(args?.serving_g ?? 100),
          kcal: Number(args?.kcal ?? 0),
          protein_g: Number(args?.protein_g ?? 0),
          carbs_g: Number(args?.carbs_g ?? 0),
          fat_g: Number(args?.fat_g ?? 0),
        };
        if (!row.name) return { error: "Name fehlt" };
        const { data: ins, error } = await supabase
          .from("food_entries")
          .insert(row)
          .select("id")
          .single();
        if (error) return { error: error.message };
        const logId = await logAction(supabase, userId, {
          action_type: "add_food_entry",
          target_table: "food_entries",
          target_id: (ins as any).id,
          old_value: null,
          new_value: row,
          summary: `${row.name} · ${Math.round(row.kcal)} kcal`,
          undo_minutes: 60,
        });
        await emitTimeline(supabase, userId, {
          event_type: "action",
          category: "food",
          icon: "🍽",
          title: `${row.name}`,
          summary: `${Math.round(row.kcal)} kcal · ${Math.round(row.protein_g)} g Protein`,
          coach_visible: true,
          metadata: { meal: row.meal, kcal: row.kcal, protein_g: row.protein_g },
        });
        const proteinMile = await detectProteinGoalMilestone(supabase, userId, today);
        if (proteinMile) await emitTimeline(supabase, userId, proteinMile);
        return { done: true, entry_id: (ins as any).id, log_id: logId };
      }

      case "complete_training": {
        let sessionId = args?.session_id as string | undefined;
        if (!sessionId) {
          const { data } = await supabase
            .from("training_sessions")
            .select("id")
            .eq("client_id", userId)
            .neq("status", "completed")
            .lte("session_date", isoDay())
            .order("session_date", { ascending: false })
            .limit(1);
          sessionId = (data as any)?.[0]?.id;
        }
        if (!sessionId) return { error: "Keine offene Trainingseinheit gefunden." };
        const { data: prev } = await supabase
          .from("training_sessions")
          .select("status, completed_at, notes")
          .eq("id", sessionId)
          .eq("client_id", userId)
          .maybeSingle();
        if (!prev) return { error: "Trainingseinheit nicht gefunden." };
        const { error } = await supabase
          .from("training_sessions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            notes: args?.note ?? (prev as any).notes ?? null,
          })
          .eq("id", sessionId)
          .eq("client_id", userId);
        if (error) return { error: error.message };
        const logId = await logAction(supabase, userId, {
          action_type: "complete_training",
          target_table: "training_sessions",
          target_id: sessionId,
          old_value: prev,
          new_value: { status: "completed" },
          summary: "Training abgehakt",
          undo_minutes: 60,
        });
        return { done: true, session_id: sessionId, log_id: logId };
      }

      case "reschedule_training": {
        const newDate = String(args?.new_date ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { error: "Ungültiges Datum" };
        let sessionId = args?.session_id as string | undefined;
        if (!sessionId) {
          const { data } = await supabase
            .from("training_sessions")
            .select("id")
            .eq("client_id", userId)
            .neq("status", "completed")
            .gte("session_date", isoDay())
            .order("session_date", { ascending: true })
            .limit(1);
          sessionId = (data as any)?.[0]?.id;
        }
        if (!sessionId) return { error: "Keine Einheit zum Verschieben gefunden." };
        const { data: prev } = await supabase
          .from("training_sessions")
          .select("session_date, status")
          .eq("id", sessionId)
          .eq("client_id", userId)
          .maybeSingle();
        if (!prev) return { error: "Trainingseinheit nicht gefunden." };
        const { error } = await supabase
          .from("training_sessions")
          .update({ session_date: newDate })
          .eq("id", sessionId)
          .eq("client_id", userId);
        if (error) return { error: error.message };
        const logId = await logAction(supabase, userId, {
          action_type: "reschedule_training",
          target_table: "training_sessions",
          target_id: sessionId,
          old_value: prev,
          new_value: { session_date: newDate },
          summary: `Training auf ${newDate} verschoben`,
          undo_minutes: 120,
        });
        return { done: true, session_id: sessionId, new_date: newDate, log_id: logId };
      }

      case "undo_last_action": {
        const { data: last } = await supabase
          .from("fuely_action_log")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "done")
          .is("undone_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!last) return { error: "Nichts zum Rückgängig machen." };
        const row = last as any;
        if (row.undo_until && new Date(row.undo_until).getTime() < Date.now()) {
          return { error: "Das Undo-Fenster ist abgelaufen." };
        }
        const undone = await revertAction(supabase, userId, row);
        if (!undone.ok) return { error: undone.error ?? "Undo fehlgeschlagen" };
        await supabase
          .from("fuely_action_log")
          .update({ status: "undone", undone_at: new Date().toISOString() })
          .eq("id", row.id);
        return { done: true, undone_action: row.action_type, summary: row.summary };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { error: err?.message ?? "tool error" };
  }
}

// ==================================================================
// Helpers
// ==================================================================

async function logAction(
  supabase: SB,
  userId: string,
  entry: {
    action_type: string;
    target_table?: string | null;
    target_id?: string | null;
    old_value?: any;
    new_value?: any;
    summary?: string;
    undo_minutes?: number;
  },
): Promise<string | null> {
  const undo_until = entry.undo_minutes
    ? new Date(Date.now() + entry.undo_minutes * 60_000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("fuely_action_log")
    .insert({
      user_id: userId,
      action_type: entry.action_type,
      target_table: entry.target_table ?? null,
      target_id: entry.target_id ?? null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      summary: entry.summary ?? null,
      source: "fuely",
      status: "done",
      undo_until,
    })
    .select("id")
    .single();
  if (error) return null;
  return (data as any)?.id ?? null;
}

async function revertAction(
  supabase: SB,
  userId: string,
  row: any,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (row.action_type) {
      case "log_water": {
        const [_, day] = String(row.target_id ?? "").split(":");
        const glasses = Number(row.old_value?.glasses ?? 0);
        const { error } = await supabase
          .from("water_logs")
          .upsert({ user_id: userId, entry_date: day, glasses });
        return { ok: !error, error: error?.message };
      }
      case "log_weight":
      case "log_measurement": {
        if (!row.target_id) return { ok: false, error: "Kein Ziel" };
        // Wenn old_value existiert → zurückschreiben, sonst löschen (war neuer Eintrag)
        if (row.old_value && Object.keys(row.old_value).length > 0) {
          const { error } = await supabase
            .from("body_measurements")
            .update(row.old_value)
            .eq("id", row.target_id)
            .eq("user_id", userId);
          return { ok: !error, error: error?.message };
        }
        const { error } = await supabase
          .from("body_measurements")
          .delete()
          .eq("id", row.target_id)
          .eq("user_id", userId);
        return { ok: !error, error: error?.message };
      }
      case "add_food_entry": {
        if (!row.target_id) return { ok: false, error: "Kein Ziel" };
        const { error } = await supabase
          .from("food_entries")
          .delete()
          .eq("id", row.target_id)
          .eq("user_id", userId);
        return { ok: !error, error: error?.message };
      }
      case "complete_training": {
        if (!row.target_id) return { ok: false, error: "Kein Ziel" };
        const { error } = await supabase
          .from("training_sessions")
          .update({
            status: row.old_value?.status ?? "planned",
            completed_at: row.old_value?.completed_at ?? null,
          })
          .eq("id", row.target_id)
          .eq("client_id", userId);
        return { ok: !error, error: error?.message };
      }
      case "reschedule_training": {
        if (!row.target_id || !row.old_value?.session_date)
          return { ok: false, error: "Kein Ziel" };
        const { error } = await supabase
          .from("training_sessions")
          .update({ session_date: row.old_value.session_date })
          .eq("id", row.target_id)
          .eq("client_id", userId);
        return { ok: !error, error: error?.message };
      }
      default:
        return { ok: false, error: "Aktionstyp nicht rückgängig machbar" };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "revert failed" };
  }
}


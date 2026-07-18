/**
 * Fuely Tools — serverseitige Datenzugriffe, die der KI-Coach als
 * OpenAI-kompatible "function tools" aufrufen kann. Alle Queries laufen
 * über den authentifizierten Supabase-Client (RLS greift).
 *
 * Server-only Datei (`.server.ts`), nicht ins Client-Bundle importieren.
 */

type SB = any; // typed as any to avoid heavy type gymnastics; RLS enforced

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
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
] as const;

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
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { error: err?.message ?? "tool error" };
  }
}

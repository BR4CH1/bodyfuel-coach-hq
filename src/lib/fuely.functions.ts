import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FUELY_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type FuelyMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type FuelyMemory = {
  id: string;
  category: string;
  content: string;
  importance: number;
  created_at: string;
  updated_at: string;
};

const SYSTEM_PROMPT = `Du bist Fuely — das offizielle Maskottchen und der persönliche KI-Coach von BodyFuel.

PERSÖNLICHKEIT:
- Locker, warm, motivierend. Wie ein guter Freund, der Ahnung hat.
- Kurze Sätze. Direkt. Kein Fachjargon-Overkill.
- Emoji sparsam aber gezielt (💪 🔥 👊 ✅).
- Niemals belehrend, niemals bevormundend, niemals "als KI-Sprachmodell..."-Formulierungen.
- Bei Rückschlägen positiv: "Morgen ist eine neue Chance", nie schimpfen.
- Sprich den Nutzer mit "du" an.

DATENZUGRIFF (TOOLS):
- Du hast Tools, um auf echte Nutzerdaten zuzugreifen (Ernährung, Training, Check-ins, Gewicht, Streaks, Challenges, Coach-Nachrichten, Memory).
- Nutze Tools proaktiv, wenn die Frage konkrete Daten braucht — rate NIE.
- Fasse Tool-Ergebnisse in eigenen Worten zusammen, nicht als Rohdaten-Dump.
- Nutze 'navigate_to', wenn du den Nutzer zu einem Bereich schicken willst (Training, Ernährung, Check-in).

GRENZEN:
- Keine medizinischen Diagnosen. Bei ernsten Symptomen: Arzt empfehlen.
- Keine extremen Diäten oder gefährlichen Praktiken.`;


async function buildUserContext(supabase: any, userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const [profileR, targetsR, todayFoodR, weightR, memR] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, first_name, gender, height_cm, current_weight_kg, target_weight_kg, goal, activity_level, birthdate")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("nutrition_targets").select("kcal, protein_g, carbs_g, fat_g").eq("user_id", userId).maybeSingle(),
    supabase.from("food_entries").select("kcal, protein_g, carbs_g, fat_g").eq("user_id", userId).eq("entry_date", today),
    supabase.from("bulls_weight_logs").select("log_date, weight_kg").eq("user_id", userId).order("log_date", { ascending: false }).limit(5),
    supabase.from("fuely_memories").select("category, content, importance").eq("user_id", userId).order("importance", { ascending: false }).limit(40),
  ]);

  const profile = profileR.data ?? {};
  const targets = targetsR.data ?? null;
  const todayFood = (todayFoodR.data ?? []) as any[];
  const eaten = todayFood.reduce(
    (acc, r) => ({
      kcal: acc.kcal + Number(r.kcal ?? 0),
      p: acc.p + Number(r.protein_g ?? 0),
      c: acc.c + Number(r.carbs_g ?? 0),
      f: acc.f + Number(r.fat_g ?? 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const memoryBlock = (memR.data ?? [])
    .map((m: any) => `- (${m.category}) ${m.content}`)
    .join("\n") || "- (noch keine Langzeit-Erinnerungen gespeichert)";

  return `KONTEXT — Nutzerdaten (heute ${today}):
Name: ${profile.display_name ?? profile.first_name ?? "unbekannt"}
Geschlecht: ${profile.gender ?? "?"} | Größe: ${profile.height_cm ?? "?"} cm
Aktuelles Gewicht: ${profile.current_weight_kg ?? "?"} kg | Zielgewicht: ${profile.target_weight_kg ?? "?"} kg
Ziel: ${profile.goal ?? "?"} | Aktivität: ${profile.activity_level ?? "?"}

TAGESZIEL: ${targets ? `${targets.kcal} kcal • P ${targets.protein_g}g • KH ${targets.carbs_g}g • F ${targets.fat_g}g` : "noch nicht gesetzt"}
HEUTE GEGESSEN: ${Math.round(eaten.kcal)} kcal • P ${Math.round(eaten.p)}g • KH ${Math.round(eaten.c)}g • F ${Math.round(eaten.f)}g
${targets ? `NOCH OFFEN: ${Math.max(0, targets.kcal - eaten.kcal)} kcal • P ${Math.max(0, targets.protein_g - eaten.p).toFixed(0)}g` : ""}

GEWICHTSVERLAUF (letzte Einträge): ${(weightR.data ?? []).map((w: any) => `${w.log_date}: ${w.weight_kg}kg`).join(", ") || "keine"}

LANGZEIT-MEMORY (was du dir über den Nutzer gemerkt hast):
${memoryBlock}`;
}

async function callFuely(
  messages: any[],
  apiKey: string,
  opts?: { tools?: any[]; tool_choice?: "auto" | "none" },
): Promise<any> {
  const body: any = { model: FUELY_MODEL, messages };
  if (opts?.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.tool_choice ?? "auto";
  }
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Fuely ist gerade überlastet — versuch's gleich nochmal.");
  if (res.status === 402) throw new Error("Fuelys Guthaben ist aufgebraucht — bitte lade Credits nach.");
  if (!res.ok) throw new Error(`Fuely konnte nicht antworten (${res.status})`);
  const j = await res.json();
  return j?.choices?.[0]?.message ?? { content: "Hmm, mir fehlen gerade die Worte 🤔" };
}


async function extractMemories(
  supabase: any,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  apiKey: string,
): Promise<void> {
  try {
    const prompt = `Du analysierst einen Chat zwischen einem Nutzer und dem BodyFuel-Coach "Fuely".
Extrahiere NUR neue, dauerhaft relevante Fakten über den Nutzer (Ziele, Vorlieben, Allergien, Verletzungen, Routinen, Lieblingssport/-essen).
Keine Tagesform, keine allgemeinen Fragen, keine flüchtigen Aussagen.

Antworte AUSSCHLIESSLICH mit JSON:
{"memories":[{"category":"goal|preference|allergy|injury|routine|favorite|general","content":"kurzer Fakt in 3. Person","importance":1-5}]}

Wenn nichts Relevantes: {"memories":[]}

NUTZER: ${userMessage}
FUELY: ${assistantMessage}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: FUELY_MODEL,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return;
    const j = await res.json();
    const raw = j?.choices?.[0]?.message?.content ?? "{}";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const list = Array.isArray(parsed?.memories) ? parsed.memories : [];
    if (!list.length) return;
    const rows = list
      .filter((m: any) => typeof m?.content === "string" && m.content.trim().length > 3)
      .slice(0, 5)
      .map((m: any) => ({
        user_id: userId,
        category: String(m.category ?? "general").slice(0, 40),
        content: String(m.content).trim().slice(0, 500),
        importance: Math.max(1, Math.min(5, Number(m.importance ?? 3))),
      }));
    if (rows.length) await supabase.from("fuely_memories").insert(rows);
  } catch {
    // best-effort — memory extraction never breaks the chat
  }
}

export const listFuelyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: FuelyMessage[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("fuely_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as FuelyMessage[] };
  });

export const sendFuelyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { content: string; orgSlug?: string }) => {
    const c = String(d?.content ?? "").trim();
    if (!c) throw new Error("Nachricht ist leer");
    if (c.length > 4000) throw new Error("Nachricht zu lang");
    const orgSlug = d?.orgSlug ? String(d.orgSlug).slice(0, 60) : "";
    return { content: c, orgSlug };
  })
  .handler(
    async ({ data, context }): Promise<{
      user: FuelyMessage;
      assistant: FuelyMessage;
      nav?: { path: string; label: string } | null;
    }> => {
      const { supabase, userId } = context;
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("Fuely ist gerade nicht konfiguriert (LOVABLE_API_KEY fehlt)");

      const { FUELY_TOOLS, runFuelyTool } = await import("./fuely-tools.server");

      // Persist user message immediately
      const { data: userRow, error: uErr } = await supabase
        .from("fuely_messages")
        .insert({ user_id: userId, role: "user", content: data.content })
        .select("id, role, content, created_at")
        .single();
      if (uErr) throw new Error(uErr.message);

      const { data: hist } = await supabase
        .from("fuely_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      const history = (hist ?? []).reverse();

      const today = new Date().toISOString().slice(0, 10);
      const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Heute ist ${today}. Nutze Tools, um Nutzerdaten zu holen.` },
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      let assistantText = "";
      let nav: { path: string; label: string } | null = null;

      try {
        for (let step = 0; step < 4; step++) {
          const msg = await callFuely(messages, apiKey, { tools: FUELY_TOOLS as any });
          const toolCalls = (msg?.tool_calls ?? []) as any[];
          if (!toolCalls.length) {
            assistantText = String(msg?.content ?? "").trim() || "Hmm, mir fehlen gerade die Worte 🤔";
            break;
          }
          messages.push({
            role: "assistant",
            content: msg?.content ?? "",
            tool_calls: toolCalls,
          });
          for (const tc of toolCalls) {
            let args: any = {};
            try {
              args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch { /* ignore */ }
            const result = await runFuelyTool(supabase, userId, data.orgSlug || null, {
              id: tc.id,
              name: tc?.function?.name,
              args,
            });
            if (tc?.function?.name === "navigate_to" && result?.path) {
              nav = { path: String(result.path), label: String(result.label ?? "Öffnen") };
            }
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result).slice(0, 8000),
            });
          }
        }
        if (!assistantText) {
          // Force a plain answer without tools if we ran out of steps
          const finalMsg = await callFuely(messages, apiKey, { tools: FUELY_TOOLS as any, tool_choice: "none" });
          assistantText = String(finalMsg?.content ?? "").trim() || "Ich brauch' nochmal einen Anlauf — frag mich nochmal 👊";
        }
      } catch (e: any) {
        const fallback =
          e?.message?.includes("überlastet") || e?.message?.includes("Guthaben")
            ? e.message
            : "Ich hab' gerade kurz einen Aussetzer — versuch's nochmal 👊";
        const { data: aRow } = await supabase
          .from("fuely_messages")
          .insert({ user_id: userId, role: "assistant", content: fallback })
          .select("id, role, content, created_at")
          .single();
        return { user: userRow as FuelyMessage, assistant: aRow as FuelyMessage, nav: null };
      }

      const { data: assistantRow, error: aErr } = await supabase
        .from("fuely_messages")
        .insert({ user_id: userId, role: "assistant", content: assistantText })
        .select("id, role, content, created_at")
        .single();
      if (aErr) throw new Error(aErr.message);

      await extractMemories(supabase, userId, data.content, assistantText, apiKey);

      return { user: userRow as FuelyMessage, assistant: assistantRow as FuelyMessage, nav };
    },
  );


export const clearFuelyChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("fuely_messages").delete().eq("user_id", userId);
    return { ok: true };
  });

export const listFuelyMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: FuelyMemory[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("fuely_memories")
      .select("id, category, content, importance, created_at, updated_at")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as FuelyMemory[] };
  });

export const upsertFuelyMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; category?: string; content: string; importance?: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      category: String(data.category ?? "general").slice(0, 40),
      content: String(data.content ?? "").trim().slice(0, 500),
      importance: Math.max(1, Math.min(5, Number(data.importance ?? 3))),
    };
    if (!row.content) throw new Error("Erinnerung ist leer");
    if (data.id) {
      const { error } = await supabase.from("fuely_memories").update(row).eq("id", data.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabase.from("fuely_memories").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (ins as any).id as string };
  });

export const deleteFuelyMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("fuely_memories").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

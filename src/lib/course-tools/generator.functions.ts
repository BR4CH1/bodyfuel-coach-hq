import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  target_group: z.string().min(1).max(200),
  goal: z.string().min(1).max(200),
  equipment: z.string().max(300).optional().default(""),
  duration_minutes: z.number().int().min(10).max(120).default(45),
  intensity: z.enum(["easy", "medium", "hard"]).default("medium"),
});

export type GeneratedCourse = {
  name: string;
  summary: string;
  blocks: {
    phase: "warmup" | "main" | "finisher" | "cooldown";
    title: string;
    duration_seconds: number;
    timer_type: "countdown" | "interval" | "tabata" | "emom" | "amrap" | "stopwatch";
    exercises: { name: string; cue?: string; reps?: string; work_sec?: number; rest_sec?: number }[];
    notes?: string;
  }[];
};

export const generateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<GeneratedCourse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const system = `Du bist erfahrener Group-Fitness-Trainer. Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Schema:
{
  "name": "string",
  "summary": "string",
  "blocks": [
    {
      "phase": "warmup" | "main" | "finisher" | "cooldown",
      "title": "string",
      "duration_seconds": number,
      "timer_type": "countdown" | "interval" | "tabata" | "emom" | "amrap" | "stopwatch",
      "exercises": [{ "name": "string", "cue": "string?", "reps": "string?", "work_sec": number?, "rest_sec": number? }],
      "notes": "string?"
    }
  ]
}
Immer 4 Blöcke in Reihenfolge: warmup, main, finisher, cooldown. Passe timer_type & Dauer sinnvoll an.`;

    const prompt = `Zielgruppe: ${data.target_group}
Ziel: ${data.goal}
Equipment: ${data.equipment || "Bodyweight"}
Gesamtdauer: ${data.duration_minutes} Minuten
Intensität: ${data.intensity}
Erstelle einen deutschsprachigen Kursplan.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (res.status === 429) throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
    if (res.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
    if (!res.ok) throw new Error(`AI-Fehler [${res.status}]`);

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed as GeneratedCourse;
  });

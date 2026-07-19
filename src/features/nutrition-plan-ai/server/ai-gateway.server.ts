import { extractJsonObject } from "@/features/nutrition-plan-ai/lib/plan.logic";
import type { GeneratedDay, PlanScheduleDay } from "@/features/nutrition-plan-ai/types";

const MODEL_CANDIDATES = [
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
] as const;

async function callModel(apiKey: string, model: string, prompt: string): Promise<string> {
  const tokenLimit = model.startsWith("openai/")
    ? { max_completion_tokens: 32000 }
    : { max_tokens: 32000 };
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      ...tokenLimit,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (response.status === 429) {
    throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
  }
  if (response.status === 402) {
    throw new Error("Guthaben aufgebraucht — bitte aufladen.");
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fehler [${response.status}]: ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content ?? "{}";
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

export async function generateBasePlanDays(input: {
  apiKey: string;
  prompt: string;
  correctionNote?: string;
  aiPlanDays: number;
  aiSchedule: PlanScheduleDay[];
}): Promise<GeneratedDay[]> {
  const finalPrompt = input.correctionNote
    ? `${input.prompt}\n\n${input.correctionNote}`
    : input.prompt;
  let lastError: Error | null = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const raw = await callModel(input.apiKey, model, finalPrompt);
      const jsonText = extractJsonObject(raw);
      if (!jsonText) {
        lastError = new Error(`Leere Antwort von ${model}`);
        continue;
      }

      let parsed: { days?: GeneratedDay[] } = {};
      try {
        parsed = JSON.parse(jsonText) as { days?: GeneratedDay[] };
      } catch {
        lastError = new Error(`Antwort von ${model} konnte nicht gelesen werden.`);
        continue;
      }

      const days = (parsed.days ?? [])
        .slice(0, input.aiPlanDays)
        .map((day, index): GeneratedDay => ({
          ...day,
          type: input.aiSchedule[index]?.type ?? day.type,
        }));
      if (!days.length) {
        lastError = new Error(`Keine Tage von ${model}.`);
        continue;
      }
      return days;
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (message.startsWith("Rate-Limit") || message.startsWith("Guthaben")) throw error;
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("Keine Tage generiert.");
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssessmentSign = "+" | "=" | "-";
export type AssessmentOverall = "strongly_improved" | "improved" | "unchanged" | "worsened";

export type PhotoAssessment = {
  id: string;
  user_id: string;
  coach_id: string | null;
  before_date: string | null;
  after_date: string;
  fat_belly: AssessmentSign | null;
  fat_hip: AssessmentSign | null;
  fat_back: AssessmentSign | null;
  muscle_chest: AssessmentSign | null;
  muscle_shoulder: AssessmentSign | null;
  muscle_arms: AssessmentSign | null;
  muscle_back: AssessmentSign | null;
  muscle_legs: AssessmentSign | null;
  overall: AssessmentOverall | null;
  ai_summary: string | null;
  coach_note: string | null;
  released_to_client: boolean;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

const sign = z.enum(["+", "=", "-"]).nullable().optional();
const overallEnum = z.enum(["strongly_improved", "improved", "unchanged", "worsened"]).nullable().optional();

async function ensureCoach(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "coach" });
  if (!data) throw new Error("Nur Coaches");
}

export const listPhotoAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string }) => d)
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("photo_assessments")
      .select("*")
      .eq("user_id", target)
      .order("after_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PhotoAssessment[];
  });

export const savePhotoAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<PhotoAssessment> & { user_id: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        user_id: z.string().uuid(),
        before_date: z.string().date().nullable().optional(),
        after_date: z.string().date().optional(),
        fat_belly: sign,
        fat_hip: sign,
        fat_back: sign,
        muscle_chest: sign,
        muscle_shoulder: sign,
        muscle_arms: sign,
        muscle_back: sign,
        muscle_legs: sign,
        overall: overallEnum,
        ai_summary: z.string().max(4000).nullable().optional(),
        coach_note: z.string().max(2000).nullable().optional(),
        released_to_client: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureCoach(context);
    const { id, ...rest } = data;
    const payload: any = {
      ...rest,
      coach_id: context.userId,
      after_date: rest.after_date ?? new Date().toISOString().slice(0, 10),
    };
    if (payload.released_to_client && !payload.released_at) {
      payload.released_at = new Date().toISOString();
    }
    const q = id
      ? context.supabase.from("photo_assessments").update(payload).eq("id", id).select().single()
      : context.supabase.from("photo_assessments").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row as PhotoAssessment;
  });

export const deletePhotoAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureCoach(context);
    const { error } = await context.supabase.from("photo_assessments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// AI compare: takes file_paths for before+after sets, generates signed URLs, calls Lovable AI Gateway.
export const aiComparePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id: string;
    before_paths: string[];
    after_paths: string[];
  }) =>
    z
      .object({
        user_id: z.string().uuid(),
        before_paths: z.array(z.string()).min(1).max(4),
        after_paths: z.array(z.string()).min(1).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureCoach(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const sign = async (paths: string[]) => {
      const out: string[] = [];
      for (const p of paths) {
        const { data: s } = await context.supabase.storage
          .from("progress-photos")
          .createSignedUrl(p, 60 * 30);
        if (s?.signedUrl) out.push(s.signedUrl);
      }
      return out;
    };

    const beforeUrls = await sign(data.before_paths);
    const afterUrls = await sign(data.after_paths);

    const content: any[] = [
      {
        type: "text",
        text:
          "Du bist Coach-Assistent bei BodyFuel. Vergleiche die VORHER- und NACHHER-Fotos und gib eine JSON-Bewertung zurück. " +
          "Werte (+) = verbessert / mehr Muskel / weniger Fett, (=) = unverändert, (-) = verschlechtert. " +
          "Antworte ausschließlich als JSON-Objekt mit den Feldern: " +
          "fat_belly, fat_hip, fat_back, muscle_chest, muscle_shoulder, muscle_arms, muscle_back, muscle_legs (jeweils '+'/'='/'-'), " +
          "overall ('strongly_improved'|'improved'|'unchanged'|'worsened'), " +
          "summary (max 4 Sätze, Deutsch).",
      },
      { type: "text", text: "VORHER:" },
      ...beforeUrls.map((u) => ({ type: "image_url", image_url: { url: u } })),
      { type: "text", text: "NACHHER:" },
      ...afterUrls.map((u) => ({ type: "image_url", image_url: { url: u } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI Fehler ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // try to extract JSON
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    return {
      fat_belly: parsed.fat_belly ?? null,
      fat_hip: parsed.fat_hip ?? null,
      fat_back: parsed.fat_back ?? null,
      muscle_chest: parsed.muscle_chest ?? null,
      muscle_shoulder: parsed.muscle_shoulder ?? null,
      muscle_arms: parsed.muscle_arms ?? null,
      muscle_back: parsed.muscle_back ?? null,
      muscle_legs: parsed.muscle_legs ?? null,
      overall: parsed.overall ?? null,
      ai_summary: parsed.summary ?? null,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AthleteCheckin = {
  id: string;
  user_id: string;
  organization_id: string | null;
  checkin_date: string;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  training_feel: number | null;
  pain_level: number | null;
  pain_note: string | null;
  notes: string | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
};

const scoreOpt = z.number().int().min(0).max(5).optional().nullable();

const submitSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  checkinDate: z.string().min(10).optional(), // yyyy-mm-dd; default = today
  sleep: scoreOpt,
  energy: scoreOpt,
  stress: scoreOpt,
  trainingFeel: scoreOpt,
  painLevel: scoreOpt,
  painNote: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  weightKg: z.number().positive().max(400).optional().nullable(),
});

/** Spieler reicht seinen eigenen Check-in ein (Upsert pro Tag). */
export const submitCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const row = {
      user_id: userId,
      organization_id: data.organizationId ?? null,
      checkin_date: data.checkinDate ?? today,
      sleep: data.sleep ?? null,
      energy: data.energy ?? null,
      stress: data.stress ?? null,
      training_feel: data.trainingFeel ?? null,
      pain_level: data.painLevel ?? null,
      pain_note: data.painNote ?? null,
      notes: data.notes ?? null,
      weight_kg: data.weightKg ?? null,
    };
    const { data: saved, error } = await supabase
      .from("athlete_checkins")
      .upsert(row, { onConflict: "user_id,checkin_date" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved!.id };
  });

/** Coach liest Check-ins eines Athleten. Zugriff durch RLS gesichert. */
export const listAthleteCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ userId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("athlete_checkins")
      .select("*")
      .eq("user_id", data.userId)
      .order("checkin_date", { ascending: false })
      .limit(data.limit ?? 30);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AthleteCheckin[];
  });

/** Spieler: eigener Check-in-Verlauf. */
export const listMyCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("athlete_checkins")
      .select("*")
      .eq("user_id", context.userId)
      .order("checkin_date", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AthleteCheckin[];
  });

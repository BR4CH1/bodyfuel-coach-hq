import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Coach-Quick-Actions auf einem einzelnen Athleten innerhalb einer Organisation:
 *  - Nachricht senden (org-scoped, funktioniert auch für Bulls-Staff, nicht nur für den Root-Coach)
 *  - Coach-Notiz anlegen / listen
 * Aufgaben laufen weiterhin über `createAthleteTask` (coach-athlete-tasks.functions.ts).
 */

async function assertOrgAccess(
  supabase: any,
  callerId: string,
  orgId: string,
): Promise<void> {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: callerId,
    _role: "coach",
  });
  if (isCoach) return;
  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    _user_id: callerId,
    _org_id: orgId,
  });
  if (isAdmin) return;
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("user_id", callerId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!staff) throw new Error("Kein Zugriff auf diesen Athleten.");
}

/* -------- Nachricht an Athlet (org-scoped) -------- */

const sendMsgSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const sendOrgMessageToAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendMsgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertOrgAccess(supabase, callerId, data.orgId);

    const { error } = await supabase.from("coach_messages").insert({
      thread_user_id: data.userId,
      sender_id: callerId,
      from_coach: true,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Notizen -------- */

const noteCreateSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const createCoachAthleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => noteCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertOrgAccess(supabase, callerId, data.orgId);

    const { data: row, error } = await supabase
      .from("coach_athlete_notes")
      .insert({
        organization_id: data.orgId,
        athlete_user_id: data.userId,
        author_user_id: callerId,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

const noteListSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type CoachAthleteNote = {
  id: string;
  body: string;
  author_user_id: string;
  author_name: string | null;
  created_at: string;
  is_mine: boolean;
};

export const listCoachAthleteNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => noteListSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ notes: CoachAthleteNote[] }> => {
    const { supabase, userId: callerId } = context;
    await assertOrgAccess(supabase, callerId, data.orgId);

    const { data: rows, error } = await supabase
      .from("coach_athlete_notes")
      .select("id, body, author_user_id, created_at")
      .eq("organization_id", data.orgId)
      .eq("athlete_user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const authorIds = Array.from(new Set(list.map((r) => r.author_user_id)));
    let names = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, nickname")
        .in("user_id", authorIds);
      (profs ?? []).forEach((p: any) => {
        names.set(p.user_id, p.nickname || p.display_name || null);
      });
    }

    return {
      notes: list.map((r) => ({
        id: r.id,
        body: r.body,
        author_user_id: r.author_user_id,
        author_name: names.get(r.author_user_id) ?? null,
        created_at: r.created_at,
        is_mine: r.author_user_id === callerId,
      })),
    };
  });

const noteDeleteSchema = z.object({ noteId: z.string().uuid() });

export const deleteCoachAthleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => noteDeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("coach_athlete_notes")
      .delete()
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

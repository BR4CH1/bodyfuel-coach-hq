import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "bulls-performance-videos";

async function assertBulls(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_group", { _user_id: userId, _group: "bulls" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Bulls-Zugang");
}

async function isCoachOrStaff(supabase: any, userId: string): Promise<boolean> {
  const [{ data: coachRow }, { data: staffRows }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    supabase
      .from("staff_assignments")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["organization_admin", "coach"])
      .limit(1),
  ]);
  return !!coachRow || (Array.isArray(staffRows) && staffRows.length > 0);
}

// -------------------- PLAYER --------------------

export const listMyPerformanceTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBulls(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bulls_performance_tests")
      .select("*")
      .eq("user_id", context.userId)
      .order("performed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const submitSchema = z.object({
  module_id: z.string().min(1),
  test_id: z.string().min(1),
  variant: z.string().optional().nullable(),
  result_value: z.number().finite(),
  result_unit: z.enum(["s", "cm", "kg"]),
  reps: z.number().int().positive().optional().nullable(),
  rir: z.number().min(0).max(10).optional().nullable(),
  bodyweight_kg: z.number().positive().optional().nullable(),
  measurement_method: z.enum(["hand", "video", "timing_gates"]).optional().nullable(),
  surface: z.enum(["grass", "turf", "indoor", "track", "other"]).optional().nullable(),
  footwear: z.enum(["cleats", "turfs", "runners", "indoor", "other"]).optional().nullable(),
  video_path: z.string().optional().nullable(),
  performed_at: z.string().optional().nullable(),
});

export const submitPerformanceTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => submitSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);

    // Fetch current position for snapshot
    const { data: prof } = await context.supabase
      .from("bulls_profiles")
      .select("position")
      .eq("user_id", context.userId)
      .maybeSingle();

    const payload = {
      user_id: context.userId,
      performance_profile: "football_bulls",
      module_id: data.module_id,
      test_id: data.test_id,
      variant: data.variant ?? null,
      position_snapshot: prof?.position ?? null,
      result_value: data.result_value,
      result_unit: data.result_unit,
      reps: data.reps ?? null,
      rir: data.rir ?? null,
      bodyweight_kg: data.bodyweight_kg ?? null,
      measurement_method: data.measurement_method ?? null,
      surface: data.surface ?? null,
      footwear: data.footwear ?? null,
      video_path: data.video_path ?? null,
      video_uploaded_at: data.video_path ? new Date().toISOString() : null,
      verification_status: "submitted",
      performed_at: data.performed_at ?? new Date().toISOString(),
    };

    const { data: row, error } = await context.supabase
      .from("bulls_performance_tests")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Create a signed upload URL for video upload. Client uploads directly to Storage. */
export const createVideoUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { test_id: string; ext?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);
    const ext = (data.ext || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) || "mp4";
    const rand = crypto.randomUUID();
    const path = `${context.userId}/${data.test_id}/${rand}.${ext}`;
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Signed URL for playback (60 min). Works for own videos, or for coaches for any. */
export const getVideoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// -------------------- COACH --------------------

export const listPendingPerformanceTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isCoachOrStaff(context.supabase, context.userId))) {
      throw new Error("Nicht berechtigt");
    }
    const { data, error } = await context.supabase
      .from("bulls_performance_tests")
      .select("*")
      .eq("verification_status", "submitted")
      .order("performed_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Enrich with player name & position
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    let profiles: Record<string, { name: string; position: string | null }> = {};
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("bulls_profiles")
        .select("user_id, first_name, last_name, position")
        .in("user_id", ids);
      for (const p of profs ?? []) {
        profiles[p.user_id] = {
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Spieler",
          position: p.position ?? null,
        };
      }
    }
    return (data ?? []).map((r: any) => ({
      ...r,
      player_name: profiles[r.user_id]?.name ?? "Spieler",
      player_position: profiles[r.user_id]?.position ?? null,
    }));
  });

export const listPerformanceCheckStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isCoachOrStaff(context.supabase, context.userId))) {
      throw new Error("Nicht berechtigt");
    }
    const [{ count: pendingCount }, { count: verifiedCount }, { data: playersTested }] = await Promise.all([
      context.supabase.from("bulls_performance_tests").select("id", { count: "exact", head: true }).eq("verification_status", "submitted"),
      context.supabase.from("bulls_performance_tests").select("id", { count: "exact", head: true }).in("verification_status", ["verified", "corrected"]),
      context.supabase.from("bulls_performance_tests").select("user_id").in("verification_status", ["verified", "corrected"]),
    ]);
    const uniquePlayers = new Set((playersTested ?? []).map((r: any) => r.user_id)).size;
    return {
      pending: pendingCount ?? 0,
      verifiedResults: verifiedCount ?? 0,
      playersTested: uniquePlayers,
    };
  });

const verifySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["verify", "correct", "reject"]),
  coach_corrected_value: z.number().finite().optional().nullable(),
  coach_note: z.string().max(500).optional().nullable(),
  rejection_reason: z.string().max(500).optional().nullable(),
});

export const decidePerformanceTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => verifySchema.parse(raw))
  .handler(async ({ data, context }) => {
    if (!(await isCoachOrStaff(context.supabase, context.userId))) {
      throw new Error("Nicht berechtigt");
    }
    const base = {
      verified_by: context.userId,
      verified_at: new Date().toISOString(),
      coach_note: data.coach_note ?? null,
    };
    let update:
      | (typeof base & { verification_status: "verified"; rejection_reason: null })
      | (typeof base & { verification_status: "corrected"; coach_corrected_value: number; rejection_reason: null })
      | (typeof base & { verification_status: "rejected"; rejection_reason: string });
    if (data.action === "verify") {
      update = { ...base, verification_status: "verified", rejection_reason: null };
    } else if (data.action === "correct") {
      if (data.coach_corrected_value == null) throw new Error("Korrigierter Wert fehlt");
      update = {
        ...base,
        verification_status: "corrected",
        coach_corrected_value: data.coach_corrected_value,
        rejection_reason: null,
      };
    } else {
      if (!data.rejection_reason) throw new Error("Ablehnungsgrund fehlt");
      update = { ...base, verification_status: "rejected", rejection_reason: data.rejection_reason };
    }
    const { error } = await context.supabase
      .from("bulls_performance_tests")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

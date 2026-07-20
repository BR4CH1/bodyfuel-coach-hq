import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BullsPosition = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "KP" | "COACH";
export type BullsGoal = "fat_loss" | "muscle_gain" | "performance" | "general_fitness";

async function assertBulls(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_group", { _user_id: userId, _group: "bulls" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Bulls-Zugang");
}


export const getMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_groups")
      .select("group_name")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.group_name as string);
  });

export const getBullsProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBulls(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bulls_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertBullsProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    first_name: string;
    last_name: string;
    email: string;
    weight_kg: number;
    height_cm: number;
    position: BullsPosition;
    main_goal: BullsGoal;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);
    const payload = { user_id: context.userId, ...data };
    const { error } = await context.supabase.from("bulls_profiles").upsert(payload);
    if (error) throw new Error(error.message);
    // Track onboarding event
    await context.supabase
      .from("bulls_hub_events")
      .upsert({ user_id: context.userId, kind: "onboarding_complete" }, { onConflict: "user_id,kind" });
    return { ok: true };
  });

export const logBullsWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { weight_kg: number; log_date?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);
    const log_date = data.log_date ?? new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("bulls_weight_logs")
      .upsert({ user_id: context.userId, log_date, weight_kg: data.weight_kg });
    if (error) throw new Error(error.message);
    // Sync current weight to profile
    await context.supabase
      .from("bulls_profiles")
      .update({ weight_kg: data.weight_kg })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const listBullsWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBulls(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bulls_weight_logs")
      .select("log_date, weight_kg")
      .eq("user_id", context.userId)
      .order("log_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const trackHubEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string }) => d)
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);
    const allowed = new Set([
      "onboarding_complete",
      "nutrition_plan_opened",
      "training_plan_opened",
      "benchmarks_opened",
    ]);
    if (!allowed.has(data.kind)) throw new Error("Invalid event");
    await context.supabase
      .from("bulls_hub_events")
      .upsert({ user_id: context.userId, kind: data.kind }, { onConflict: "user_id,kind" });
    return { ok: true };
  });

export const getStarterScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBulls(context.supabase, context.userId);
    const [{ data: events }, { data: weights }, { data: profile }] = await Promise.all([
      context.supabase.from("bulls_hub_events").select("kind").eq("user_id", context.userId),
      context.supabase.from("bulls_weight_logs").select("id").eq("user_id", context.userId),
      context.supabase.from("bulls_profiles").select("main_goal").eq("user_id", context.userId).maybeSingle(),
    ]);
    const kinds = new Set((events ?? []).map((e: any) => e.kind));
    let score = 0;
    if (kinds.has("onboarding_complete")) score += 20;
    if (profile?.main_goal) score += 15;
    if ((weights?.length ?? 0) >= 1) score += 15;
    if (kinds.has("nutrition_plan_opened")) score += 15;
    if (kinds.has("training_plan_opened")) score += 15;
    if ((weights?.length ?? 0) >= 2) score += 20;
    return { score };
  });

export const listProgressPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBulls(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bulls_progress_photos")
      .select("*")
      .eq("user_id", context.userId)
      .order("photo_date", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    // sign URLs
    const signed = await Promise.all(rows.map(async (r: any) => {
      const sign = async (p: string | null) => {
        if (!p) return null;
        const { data: s } = await context.supabase.storage
          .from("bulls-progress-photos")
          .createSignedUrl(p, 60 * 60);
        return s?.signedUrl ?? null;
      };
      return {
        ...r,
        front_url: await sign(r.front_path),
        side_url: await sign(r.side_path),
        back_url: await sign(r.back_path),
      };
    }));
    return signed;
  });

export const saveProgressPhotoSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { photo_date: string; front_path?: string | null; side_path?: string | null; back_path?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertBulls(context.supabase, context.userId);
    const { error } = await context.supabase.from("bulls_progress_photos").insert({
      user_id: context.userId,
      photo_date: data.photo_date,
      front_path: data.front_path ?? null,
      side_path: data.side_path ?? null,
      back_path: data.back_path ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

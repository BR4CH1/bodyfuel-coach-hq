import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIAL_DAYS_DEFAULT = 7;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(base: string | null | undefined, days: number): string {
  const d = base ? new Date(base) : new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const TRIAL_TRAINING_PLAN_TITLE = "Trial Starterplan";

async function seedTrialTrainingPlanFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { TRIAL_TRAINING } = await import("@/lib/bodyfuel/trialPlans");

  // Idempotent: existiert bereits ein aktiver Trial-Trainingsplan?
  const { data: existingPlan } = await supabaseAdmin
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("plan_type", "training")
    .eq("title", TRIAL_TRAINING_PLAN_TITLE)
    .maybeSingle();
  if (existingPlan?.id) return { ok: true, plan_id: existingPlan.id, created: false };

  // Falls schon ein aktiver Plan existiert (vom Coach gepflegt), nichts überschreiben.
  const { data: anyActive } = await supabaseAdmin
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("plan_type", "training")
    .eq("is_active", true)
    .maybeSingle();
  if (anyActive?.id) return { ok: true, plan_id: anyActive.id, created: false };

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("nutrition_plans")
    .insert({
      client_id: userId,
      title: TRIAL_TRAINING_PLAN_TITLE,
      plan_type: "training",
      is_active: true,
      file_path: "trial://starter-training",
      file_name: "trial-starter.json",
    })
    .select("id")
    .single();
  if (planErr) throw new Error(planErr.message);

  for (let i = 0; i < TRIAL_TRAINING.length; i++) {
    const td = TRIAL_TRAINING[i];
    const { data: dayRow, error: dayErr } = await supabaseAdmin
      .from("training_days")
      .insert({ plan_id: plan.id, name: `${td.name} — ${td.focus}`, sort_order: i })
      .select("id")
      .single();
    if (dayErr) throw new Error(dayErr.message);
    if (td.exercises.length) {
      const exRows = td.exercises.map((ex, idx) => ({
        day_id: dayRow.id,
        name: ex.name,
        target_sets: ex.sets,
        target_reps: ex.reps,
        notes: ex.notes ?? null,
        sort_order: idx,
      }));
      const { error: exErr } = await supabaseAdmin.from("training_exercises").insert(exRows);
      if (exErr) throw new Error(exErr.message);
    }
  }
  return { ok: true, plan_id: plan.id, created: true };
}

/** Stellt sicher, dass der eingeloggte Trial-Nutzer den Starter-Trainingsplan hat. */
export const ensureTrialTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => seedTrialTrainingPlanFor(context.userId));

/** Wird vom Trial-Signup nach Auth-Signup aufgerufen, um den Trial zu starten. */
export const startMyTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("trial_status, trial_start, trial_end")
      .eq("id", context.userId)
      .maybeSingle();

    // Wenn bereits aktiv/trial/abgelaufen, Trainingsplan trotzdem sicherstellen.
    if (existing && existing.trial_status !== "none") {
      if (existing.trial_status === "trial") {
        try { await seedTrialTrainingPlanFor(context.userId); } catch (e) { console.error(e); }
      }
      return {
        ok: true,
        trial_status: existing.trial_status,
        trial_start: existing.trial_start,
        trial_end: existing.trial_end,
      };
    }

    const start = todayIso();
    const end = addDaysIso(start, TRIAL_DAYS_DEFAULT);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trial_status: "trial", trial_start: start, trial_end: end })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    try { await seedTrialTrainingPlanFor(context.userId); } catch (e) { console.error(e); }
    return { ok: true, trial_status: "trial" as const, trial_start: start, trial_end: end };
  });


/** Coach: Trial verlängern (beliebige Tageszahl 1–365). Verlängert auch abgelaufene Trials. */
export const coachExtendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; days: number }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    if (!Number.isFinite(data.days) || data.days < 1 || data.days > 365) {
      throw new Error("Ungültige Tageszahl (1–365)");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("trial_status, trial_start, trial_end")
      .eq("id", data.user_id)
      .maybeSingle();

    const today = todayIso();
    const base = prof?.trial_end && prof.trial_end > today ? prof.trial_end : today;
    const newEnd = addDaysIso(base, data.days);
    const newStart = prof?.trial_start ?? today;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        trial_status: "trial",
        trial_start: newStart,
        trial_end: newEnd,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true, trial_end: newEnd };
  });

/** Coach: Neues Trial starten (auch nach Mitgliedschaft / Ablauf). */
export const coachStartTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; days: number }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    if (!Number.isFinite(data.days) || data.days < 1 || data.days > 365) {
      throw new Error("Ungültige Tageszahl (1–365)");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = todayIso();
    const end = addDaysIso(start, data.days);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trial_status: "trial", trial_start: start, trial_end: end })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true, trial_start: start, trial_end: end };
  });

/** Coach: Trial sofort beenden. */
export const coachEndTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trial_status: "trial_expired", trial_end: todayIso() })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Coach: Mitglied aktivieren (schaltet Premiumfunktionen frei). */
export const coachActivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trial_status: "active" })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aktuellen Trial-Status für Coach-Übersicht (alle Trials). */
export const listTrialUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, trial_status, trial_start, trial_end, created_at")
      .in("trial_status", ["trial", "trial_expired"])
      .order("trial_end", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

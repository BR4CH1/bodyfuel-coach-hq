import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYPAL_ME = "https://www.paypal.me/ManuSchrader";

// Aktive Pakete: smart, coaching. starter/premium bleiben für Legacy-Datensätze.
type PackageKey = "smart" | "coaching" | "starter" | "premium";

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/* ---------------- LEADS (Erstgespräch-Anfragen) ---------------- */

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      email: string;
      phone?: string;
      goal?: string;
      current_weight?: string;
      desired_package?: PackageKey | "unsure";
      message?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name = (data.name ?? "").trim();
    const email = (data.email ?? "").trim().toLowerCase();
    if (!name || name.length < 2) throw new Error("Bitte einen gültigen Namen angeben.");
    if (name.length > 120) throw new Error("Name zu lang.");
    // RFC-pragmatic email format check + length cap.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!EMAIL_RE.test(email) || email.length > 200) {
      throw new Error("Ungültige E-Mail-Adresse.");
    }
    const phone = data.phone?.trim();
    if (phone && !/^[+0-9 ()\/.-]{4,40}$/.test(phone)) {
      throw new Error("Ungültige Telefonnummer.");
    }
    const { error } = await supabaseAdmin.from("leads").insert({
      name: name.slice(0, 120),
      email: email.slice(0, 200),
      phone: phone?.slice(0, 60) || null,
      goal: data.goal?.slice(0, 200) || null,
      current_weight: data.current_weight?.slice(0, 60) || null,
      desired_package: data.desired_package || null,
      message: data.message?.slice(0, 2000) || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; status: "new" | "contacted" | "converted" | "declined" }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- COACH: KUNDEN VERWALTEN ---------------- */

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: packages, error } = await supabaseAdmin
      .from("customer_packages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = [...new Set((packages ?? []).map((p) => p.user_id))];
    if (userIds.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, phone, nickname")
      .in("id", userIds);

    // Need emails too
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailMap = new Map(usersData.users.map((u) => [u.id, u.email]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Zahlungen laden für Status-Badges
    const { data: payments } = await supabaseAdmin
      .from("payment_history")
      .select("user_id, status, amount_eur, created_at, payment_date")
      .in("user_id", userIds);

    const { data: groupsData } = await supabaseAdmin
      .from("user_groups")
      .select("user_id, group_name")
      .in("user_id", userIds);
    const groupsByUser = new Map<string, string[]>();
    for (const g of groupsData ?? []) {
      const a = groupsByUser.get(g.user_id) ?? [];
      a.push(g.group_name);
      groupsByUser.set(g.user_id, a);
    }

    const paymentsByUser = new Map<string, typeof payments>();
    for (const p of payments ?? []) {
      const arr = paymentsByUser.get(p.user_id) ?? [];
      arr.push(p);
      paymentsByUser.set(p.user_id, arr);
    }

    const DAY = 86400000;
    const now = Date.now();

    return (packages ?? []).map((p) => {
      const userPayments = paymentsByUser.get(p.user_id) ?? [];
      const pending = userPayments.filter((x) => x.status === "pending");
      const confirmed = userPayments
        .filter((x) => x.status === "confirmed")
        .sort(
          (a, b) =>
            new Date(b.payment_date).getTime() -
            new Date(a.payment_date).getTime(),
        );

      const pending_amount = pending.reduce(
        (s, x) => s + Number(x.amount_eur),
        0,
      );
      const oldestPending = pending.length
        ? pending.reduce((a, b) =>
            new Date(a.created_at) < new Date(b.created_at) ? a : b,
          )
        : null;

      let payment_due_date: string | null = null;
      let payment_days_left: number | null = null;
      let payment_status: "ok" | "due" | "overdue" = "ok";

      if (oldestPending) {
        const due = new Date(oldestPending.created_at);
        due.setDate(due.getDate() + 3);
        payment_due_date = due.toISOString().slice(0, 10);
        payment_days_left = Math.ceil((due.getTime() - now) / DAY);
        payment_status = due.getTime() < now ? "overdue" : "due";
      }

      const end = new Date(p.end_date).getTime();
      const days_until_end = Math.ceil((end - now) / DAY);
      // Paket bereits abgelaufen ohne offene Zahlung => überfällig
      if (!oldestPending && p.is_active && days_until_end < 0) {
        payment_status = "overdue";
      }

      return {
        ...p,
        email: emailMap.get(p.user_id) ?? null,
        display_name: profileMap.get(p.user_id)?.display_name ?? null,
        nickname: (profileMap.get(p.user_id) as any)?.nickname ?? null,
        phone: profileMap.get(p.user_id)?.phone ?? null,
        groups: groupsByUser.get(p.user_id) ?? [],
        last_payment_date: confirmed[0]?.payment_date ?? null,
        pending_amount,
        payment_due_date,
        payment_days_left,
        payment_status,
        days_until_end,
      };
    });
  });


export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      package: PackageKey | "trial" | "free";
      price_eur: number;
      start_date: string;
      duration_days: number;
      notes?: string;
      origin?: string;
      bulls?: boolean;
      trial_days?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.first_name?.trim() || !data.last_name?.trim() || !data.email?.trim()) {
      throw new Error("Vorname, Nachname und E-Mail erforderlich.");
    }

    const isTrial = data.package === "trial";
    const isFree = data.package === "free";
    const trialDays = Math.max(1, Math.min(365, Number(data.trial_days ?? 7)));

    // Immer die veröffentlichte URL nutzen, nie die Preview-Origin – sonst landen
    // Empfänger auf der Lovable-Preview, die einen Lovable-Login verlangt.
    const origin = "https://bodyfuel-coach-hq.lovable.app";

    // Invite per Magic Link. Trigger handle_new_user erstellt profile+user_roles.
    const firstName = data.first_name.trim().split(/\s+/)[0] ?? "";
    const lastName = data.last_name.trim();
    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    const email = data.email.trim();

    // Vor dem Invite sichern, damit die E-Mail-Anrede sofort den Coaching-Namen findet.
    const { error: leadErr } = await supabaseAdmin.from("leads").insert({
      name: displayName,
      email,
      phone: data.phone || null,
      desired_package: isTrial || isFree ? null : data.package,
      status: "converted",
      message: data.notes || null,
    });
    if (leadErr) throw new Error(leadErr.message);

    const { data: invited, error: invErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          full_name: displayName,
          name: displayName,
          ...(isFree ? { tier: "free" } : { role: "client" }),
        },
        redirectTo: isFree ? `${origin}/tracker/app` : `${origin}/welcome`,
      });

    if (invErr) throw new Error(invErr.message);
    const newUserId = invited.user.id;

    if (isFree) {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name: displayName, phone: data.phone || null })
        .eq("id", newUserId);
    } else if (isTrial) {
      const today = new Date().toISOString().slice(0, 10);
      const endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() + trialDays);
      await supabaseAdmin
        .from("profiles")
        .update({
          display_name: displayName,
          phone: data.phone || null,
          trial_status: "trial",
          trial_start: today,
          trial_end: endDate.toISOString().slice(0, 10),
        })
        .eq("id", newUserId);
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name: displayName, phone: data.phone || null })
        .eq("id", newUserId);

      const start = new Date(data.start_date);
      const end = new Date(start);
      end.setDate(end.getDate() + Number(data.duration_days || 30));

      const { error: pkgErr } = await supabaseAdmin.from("customer_packages").insert({
        user_id: newUserId,
        package: data.package as PackageKey,
        price_eur: data.price_eur,
        start_date: data.start_date,
        end_date: end.toISOString().slice(0, 10),
        is_active: true,
        notes: data.notes ?? null,
      });
      if (pkgErr) throw new Error(pkgErr.message);
    }

    if (data.bulls) {
      await supabaseAdmin
        .from("user_groups")
        .upsert(
          { user_id: newUserId, group_name: "bulls" },
          { onConflict: "user_id,group_name" },
        );
    }

    return { ok: true, user_id: newUserId, trial: isTrial };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profile, pkgs, payments, userRes, measurements, groups, lastFood, lastSet, lastCheck, lastWater, lastMeas, targets] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin
        .from("customer_packages")
        .select("*")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payment_history")
        .select("*")
        .eq("user_id", data.user_id)
        .order("payment_date", { ascending: false }),
      supabaseAdmin.auth.admin.getUserById(data.user_id),
      supabaseAdmin
        .from("body_measurements")
        .select("*")
        .eq("user_id", data.user_id)
        .order("measured_at", { ascending: false }),
      supabaseAdmin
        .from("user_groups")
        .select("group_name")
        .eq("user_id", data.user_id),
      supabaseAdmin.from("food_entries").select("created_at").eq("user_id", data.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("training_set_logs").select("performed_at").eq("client_id", data.user_id).order("performed_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("daily_checks").select("updated_at, created_at").eq("user_id", data.user_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("water_logs").select("created_at").eq("user_id", data.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("body_measurements").select("created_at").eq("user_id", data.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("nutrition_targets").select("kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest").eq("user_id", data.user_id).maybeSingle(),
    ]);


    const u = userRes.data.user as any;
    const banned = u?.banned_until
      ? new Date(u.banned_until).getTime() > Date.now()
      : false;
    const status: "invited" | "active" | "deactivated" = banned
      ? "deactivated"
      : u?.last_sign_in_at
        ? "active"
        : "invited";

    const activityCandidates = [
      (lastFood.data as any)?.created_at,
      (lastSet.data as any)?.performed_at,
      (lastCheck.data as any)?.updated_at ?? (lastCheck.data as any)?.created_at,
      (lastWater.data as any)?.created_at,
      (lastMeas.data as any)?.created_at,
      u?.last_sign_in_at,
    ].filter(Boolean) as string[];
    const last_activity_at = activityCandidates.length
      ? activityCandidates.reduce((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? a : b))
      : null;

    return {
      profile: profile.data,
      email: u?.email ?? null,
      packages: pkgs.data ?? [],
      payments: payments.data ?? [],
      measurements: measurements.data ?? [],
      groups: (groups.data ?? []).map((g: any) => g.group_name as string),
      coaching_goal: (profile.data as any)?.coaching_goal ?? null,
      next_checkin_date: (profile.data as any)?.next_checkin_date ?? null,
      targets: targets.data ?? null,
      auth: {
        invited_at: u?.invited_at ?? null,
        confirmed_at: u?.email_confirmed_at ?? u?.confirmed_at ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        last_activity_at,
        status,
      },
    };



  });

export const updateCustomerCoachingInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      user_id: string;
      coaching_goal?: string | null;
      next_checkin_date?: string | null;
      daily_step_goal?: number | null;
      sport?: string | null;
      injuries?: string | null;
      training_experience?: "beginner" | "intermediate" | "advanced" | null;
      // Stammdaten
      height_cm?: number | null;
      birthdate?: string | null;
      gender?: "male" | "female" | "other" | null;
      goal_weight_kg?: number | null;
      goal_target_date?: string | null;
      activity_level?: "sedentary" | "light" | "moderate" | "active" | "athlete" | null;
      training_goal?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.coaching_goal !== undefined) patch.coaching_goal = data.coaching_goal;
    if (data.next_checkin_date !== undefined) patch.next_checkin_date = data.next_checkin_date;
    if (data.daily_step_goal !== undefined && data.daily_step_goal !== null) {
      const n = Math.max(1000, Math.min(40000, Math.round(data.daily_step_goal)));
      patch.daily_step_goal = n;
    }
    if (data.sport !== undefined) patch.sport = data.sport ? data.sport.slice(0, 80) : null;
    if (data.injuries !== undefined) patch.injuries = data.injuries ? data.injuries.slice(0, 500) : null;
    if (data.training_experience !== undefined) patch.training_experience = data.training_experience;
    if (data.height_cm !== undefined) {
      patch.height_cm = data.height_cm == null ? null : Math.max(80, Math.min(260, Number(data.height_cm)));
    }
    if (data.birthdate !== undefined) patch.birthdate = data.birthdate || null;
    if (data.gender !== undefined) patch.gender = data.gender;
    if (data.goal_weight_kg !== undefined) {
      patch.goal_weight_kg =
        data.goal_weight_kg == null ? null : Math.max(30, Math.min(300, Number(data.goal_weight_kg)));
    }
    if (data.goal_target_date !== undefined) patch.goal_target_date = data.goal_target_date || null;
    if (data.activity_level !== undefined) patch.activity_level = data.activity_level;
    if (data.training_goal !== undefined) patch.training_goal = data.training_goal;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as any)
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Coach trägt das aktuelle Gewicht für einen Kunden ein
 * (falls Kunde es selbst noch nicht hinterlegt hat).
 * Nutzt den Admin-Client, weil RLS sonst nur self-insert erlaubt.
 */
export const setCustomerWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; weight_kg: number; measured_at?: string | null }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const w = Math.max(20, Math.min(400, Number(data.weight_kg)));
    if (!Number.isFinite(w)) throw new Error("Ungültiges Gewicht");
    const measured_at = data.measured_at || new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin
      .from("body_measurements")
      .insert({ user_id: data.user_id, weight_kg: w, measured_at });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const getCustomerRecentActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; days?: number }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const days = Math.max(1, Math.min(7, data.days ?? 3));
    const today = new Date();
    const dateList: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateList.push(d.toISOString().slice(0, 10));
    }
    const fromDate = dateList[dateList.length - 1];
    const toDate = dateList[0];
    const fromIso = `${fromDate}T00:00:00.000Z`;
    const toEndIso = `${toDate}T23:59:59.999Z`;

    const [checks, foods, sets] = await Promise.all([
      supabaseAdmin
        .from("daily_checks")
        .select("check_date, points, tasks")
        .eq("user_id", data.user_id)
        .gte("check_date", fromDate)
        .lte("check_date", toDate),
      supabaseAdmin
        .from("food_entries")
        .select("entry_date, meal, name, kcal, protein_g, carbs_g, fat_g, serving_g")
        .eq("user_id", data.user_id)
        .gte("entry_date", fromDate)
        .lte("entry_date", toDate)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("training_set_logs")
        .select("performed_at, weight_kg, reps, set_number, exercise_id, training_exercises(name)")
        .eq("client_id", data.user_id)
        .gte("performed_at", fromIso)
        .lte("performed_at", toEndIso)
        .order("performed_at", { ascending: true }),
    ]);

    const byDay = dateList.map((date) => {
      const check = (checks.data ?? []).find((c: any) => c.check_date === date) ?? null;
      const dayFoods = (foods.data ?? []).filter((f: any) => f.entry_date === date);
      const totals = dayFoods.reduce(
        (a: any, f: any) => ({
          kcal: a.kcal + Number(f.kcal || 0),
          protein_g: a.protein_g + Number(f.protein_g || 0),
          carbs_g: a.carbs_g + Number(f.carbs_g || 0),
          fat_g: a.fat_g + Number(f.fat_g || 0),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );
      const daySets = (sets.data ?? []).filter(
        (s: any) => new Date(s.performed_at).toISOString().slice(0, 10) === date,
      );
      const exMap = new Map<string, { name: string; sets: any[]; volume: number }>();
      for (const s of daySets) {
        const name = (s.training_exercises as any)?.name ?? "—";
        const key = s.exercise_id as string;
        const cur = exMap.get(key) ?? { name, sets: [] as any[], volume: 0 };
        cur.sets.push({
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
        });
        cur.volume += Number(s.weight_kg || 0) * Number(s.reps || 0);
        exMap.set(key, cur);
      }
      const exercises = Array.from(exMap.values()).map((e) => ({
        name: e.name,
        sets: e.sets.sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)),
        volume: Math.round(e.volume),
        total_sets: e.sets.length,
      }));
      const total_sets = daySets.length;
      const total_volume = exercises.reduce((s, e) => s + e.volume, 0);

      return {
        date,
        check: check ? { points: check.points, tasks: check.tasks } : null,
        nutrition: {
          totals,
          entries: dayFoods.map((f: any) => ({
            meal: f.meal,
            name: f.name,
            kcal: Number(f.kcal || 0),
            protein_g: Number(f.protein_g || 0),
            carbs_g: Number(f.carbs_g || 0),
            fat_g: Number(f.fat_g || 0),
            serving_g: Number(f.serving_g || 0),
          })),
        },
        training: {
          total_sets,
          total_volume,
          exercises,
        },
      };
    });

    return { days: byDay };
  });

/* ---------------- INVITE / PASSWORT / DEAKTIVIEREN ---------------- */

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; origin?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = "https://bodyfuel-coach-hq.lovable.app";

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u.user?.email;
    if (!email) throw new Error("Kein E-Mail-Account gefunden");

    const existingMeta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
    const emailLocalPart = email.split("@")[0]?.trim().toLowerCase() ?? "";
    const usableFirstName = (value: unknown) => {
      const first = typeof value === "string" ? value.trim().split(/\s+/)[0] : "";
      if (!first || first.includes("@")) return "";
      if (emailLocalPart && first.toLowerCase() === emailLocalPart) return "";
      return first;
    };
    let firstName = "";
    if (!firstName) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", data.user_id)
        .maybeSingle();
      firstName = usableFirstName(prof?.display_name);
    }
    if (!firstName) firstName = usableFirstName(existingMeta.first_name);
    if (!firstName) firstName = usableFirstName(existingMeta.display_name);
    if (!firstName) firstName = usableFirstName(existingMeta.full_name);
    if (!firstName) firstName = usableFirstName(existingMeta.name);

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { ...existingMeta, first_name: firstName },
      redirectTo: `${origin}/welcome`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; origin?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = "https://bodyfuel-coach-hq.lovable.app";

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u.user?.email;
    if (!email) throw new Error("Kein E-Mail-Account gefunden");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/welcome`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCustomerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.active ? "none" : "87600h",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; password: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    if (!data.password || data.password.length < 8) {
      throw new Error("Passwort muss mindestens 8 Zeichen lang sein.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Du kannst dein eigenes Konto nicht hier löschen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Abhängige Daten zuerst entfernen
    await supabaseAdmin.from("payment_history").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("customer_packages").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCustomerPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      package_id: string;
      package?: PackageKey;
      price_eur?: number;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      package?: PackageKey;
      price_eur?: number;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
      notes?: string;
    } = {};
    if (data.package !== undefined) patch.package = data.package;
    if (data.price_eur !== undefined) patch.price_eur = data.price_eur;
    if (data.start_date !== undefined) patch.start_date = data.start_date;
    if (data.end_date !== undefined) patch.end_date = data.end_date;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabaseAdmin
      .from("customer_packages")
      .update(patch)
      .eq("id", data.package_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- ZAHLUNGEN ---------------- */

export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string; extend_days?: number }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payment_history")
      .select("*")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (payErr) throw new Error(payErr.message);
    if (!payment) throw new Error("Zahlung nicht gefunden");

    await supabaseAdmin
      .from("payment_history")
      .update({ status: "confirmed", payment_date: new Date().toISOString().slice(0, 10) })
      .eq("id", data.payment_id);

    if (payment.customer_package_id) {
      const { data: pkg } = await supabaseAdmin
        .from("customer_packages")
        .select("end_date, is_active")
        .eq("id", payment.customer_package_id)
        .maybeSingle();
      if (pkg) {
        const base = new Date(
          pkg.end_date && new Date(pkg.end_date) > new Date()
            ? pkg.end_date
            : new Date().toISOString().slice(0, 10),
        );
        base.setDate(base.getDate() + (data.extend_days ?? 30));
        await supabaseAdmin
          .from("customer_packages")
          .update({
            end_date: base.toISOString().slice(0, 10),
            is_active: true,
          })
          .eq("id", payment.customer_package_id);
      }
    }
    return { ok: true };
  });

export const listPendingPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payment_history")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

/* ---------------- KUNDE (eigene Daten) ---------------- */

export const getMyPackage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pkgs, error } = await context.supabase
      .from("customer_packages")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: payments } = await context.supabase
      .from("payment_history")
      .select("*")
      .eq("user_id", context.userId)
      .order("payment_date", { ascending: false });
    return { active: pkgs?.find((p) => p.is_active) ?? pkgs?.[0] ?? null, payments: payments ?? [] };
  });

export const requestRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pkg, error } = await context.supabase
      .from("customer_packages")
      .select("*")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pkg) throw new Error("Kein aktives Paket gefunden");

    const { error: insErr } = await context.supabase.from("payment_history").insert({
      user_id: context.userId,
      customer_package_id: pkg.id,
      amount_eur: pkg.price_eur,
      method: "paypal_me",
      status: "pending",
      note: `Verlängerung Paket ${pkg.package}`,
    });
    if (insErr) throw new Error(insErr.message);

    const url = `${PAYPAL_ME}/${pkg.price_eur}EUR`;
    return { paypal_url: url };
  });

/* ---------------- PAKET-ANFRAGEN (Verlängerung / Wechsel / Kontakt) ---------------- */

export const createPackageRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      request_type: "renewal" | "change" | "contact";
      requested_package?: PackageKey | null;
      note?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: pkg } = await context.supabase
      .from("customer_packages")
      .select("package")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await context.supabase.from("package_requests").insert({
      user_id: context.userId,
      request_type: data.request_type,
      current_package: pkg?.package ?? null,
      requested_package: data.requested_package ?? null,
      note: data.note?.slice(0, 2000) ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyPackageRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("package_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPackageRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("package_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    let profilesMap: Record<string, { display_name: string | null }> = {};
    let emailsMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      profilesMap = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name }]),
      );
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      emailsMap = Object.fromEntries(
        (usersData?.users ?? []).map((u: any) => [u.id, u.email ?? ""]),
      );
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      customer_name: profilesMap[r.user_id]?.display_name ?? null,
      customer_email: emailsMap[r.user_id] ?? null,
    }));
  });

export const updatePackageRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      status: "pending" | "approved" | "declined";
      coach_note?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load the request
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("package_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Anfrage nicht gefunden");

    const { error } = await supabaseAdmin
      .from("package_requests")
      .update({
        status: data.status,
        coach_note: data.coach_note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // On approval: create a pending payment so the customer sees a "Zahlung ausstehend" hint with PayPal link
    if (data.status === "approved" && req.request_type !== "contact") {
      const PRICES: Record<string, number> = { starter: 79, coaching: 129, premium: 199 };

      // Current active package (for renewal amount + linking)
      const { data: activePkg } = await supabaseAdmin
        .from("customer_packages")
        .select("*")
        .eq("user_id", req.user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let amount = 0;
      let note = "";
      if (req.request_type === "renewal") {
        amount = Number(activePkg?.price_eur ?? PRICES[activePkg?.package ?? ""] ?? 0);
        note = `Verlängerung Paket ${activePkg?.package ?? ""}`;
      } else if (req.request_type === "change") {
        amount = PRICES[req.requested_package ?? ""] ?? 0;
        note = `Paketwechsel → ${req.requested_package}`;
      }

      if (amount > 0) {
        await supabaseAdmin.from("payment_history").insert({
          user_id: req.user_id,
          customer_package_id: activePkg?.id ?? null,
          amount_eur: amount,
          method: "paypal_me",
          status: "pending",
          note,
        });
      }
    }

    return { ok: true };
  });


/* ---------------- RANKING ---------------- */

export type RankingPeriod = "today" | "week" | "month" | "all";

export type RankingEntry = {
  user_id: string;
  display_name: string | null;
  points: number;
};

function periodStart(period: RankingPeriod): string | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "today") return d.toISOString().slice(0, 10);
  if (period === "week") {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export const getRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period: RankingPeriod }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (ids.length === 0) return [] as RankingEntry[];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameMap = new Map<string, string | null>(
      (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );

    const start = periodStart(data.period);
    const totals = new Map<string, number>();

    if (data.period === "all") {
      const { data: pts } = await supabaseAdmin
        .from("user_points")
        .select("user_id, total_points")
        .in("user_id", ids);
      (pts ?? []).forEach((r: { user_id: string; total_points: number }) => {
        totals.set(r.user_id, r.total_points);
      });
    } else {
      const daily = await supabaseAdmin
        .from("daily_checks")
        .select("user_id, points")
        .in("user_id", ids)
        .gte("check_date", start!);
      (daily.data ?? []).forEach((r: { user_id: string; points: number }) => {
        totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.points ?? 0));
      });
      const perf = await supabaseAdmin
        .from("performance_points")
        .select("user_id, points, approved")
        .in("user_id", ids)
        .gte("training_date", start!);
      (perf.data ?? []).forEach(
        (r: { user_id: string; points: number; approved: boolean }) => {
          if (!r.approved) return;
          totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.points ?? 0));
        },
      );
    }

    const rows: RankingEntry[] = ids.map((id) => ({
      user_id: id,
      display_name: nameMap.get(id) ?? null,
      points: totals.get(id) ?? 0,
    }));
    rows.sort((a, b) => b.points - a.points);
    return rows;
  });

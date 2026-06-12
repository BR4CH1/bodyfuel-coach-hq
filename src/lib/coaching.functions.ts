import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYPAL_ME = "https://www.paypal.me/ManuSchrader";

type PackageKey = "starter" | "coaching" | "premium";

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
      desired_package?: "starter" | "coaching" | "premium" | "unsure";
      message?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.name || !data.email) throw new Error("Name und E-Mail erforderlich");
    const { error } = await supabaseAdmin.from("leads").insert({
      name: data.name.trim().slice(0, 120),
      email: data.email.trim().slice(0, 200),
      phone: data.phone?.slice(0, 60) || null,
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
      .select("id, display_name, phone")
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
        phone: profileMap.get(p.user_id)?.phone ?? null,
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
      package: PackageKey;
      price_eur: number;
      start_date: string; // YYYY-MM-DD
      duration_days: number;
      notes?: string;
      origin?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Immer die veröffentlichte URL nutzen, nie die Preview-Origin – sonst landen
    // Empfänger auf der Lovable-Preview, die einen Lovable-Login verlangt.
    const origin = "https://bodyfuel-coach-hq.lovable.app";

    // Invite per Magic Link. Trigger handle_new_user erstellt profile+user_roles.
    const firstName = data.first_name.trim().split(/\s+/)[0] ?? "";
    const lastName = data.last_name.trim();
    const displayName = [firstName, lastName].filter(Boolean).join(" ");

    // Vor dem Invite sichern, damit die E-Mail-Anrede sofort den Coaching-Namen findet.
    await supabaseAdmin.from("leads").insert({
      name: displayName,
      email: data.email.trim(),
      phone: data.phone || null,
      desired_package: data.package,
      status: "converted",
      message: data.notes || null,
    });

    const { data: invited, error: invErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: {
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          full_name: displayName,
          name: displayName,
          role: "client",
        },
        redirectTo: `${origin}/welcome`,
      });

    if (invErr) throw new Error(invErr.message);
    const newUserId = invited.user.id;

    // Im Coaching-Profil den vollständigen Namen und optional Telefon speichern.
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName, phone: data.phone || null })
      .eq("id", newUserId);

    const start = new Date(data.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + Number(data.duration_days || 30));

    const { error: pkgErr } = await supabaseAdmin.from("customer_packages").insert({
      user_id: newUserId,
      package: data.package,
      price_eur: data.price_eur,
      start_date: data.start_date,
      end_date: end.toISOString().slice(0, 10),
      is_active: true,
      notes: data.notes ?? null,
    });
    if (pkgErr) throw new Error(pkgErr.message);

    return { ok: true, user_id: newUserId };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profile, pkgs, payments, userRes] = await Promise.all([
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

    return {
      profile: profile.data,
      email: u?.email ?? null,
      packages: pkgs.data ?? [],
      payments: payments.data ?? [],
      auth: {
        invited_at: u?.invited_at ?? null,
        confirmed_at: u?.email_confirmed_at ?? u?.confirmed_at ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        status,
      },
    };
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
      requested_package?: "starter" | "coaching" | "premium" | null;
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


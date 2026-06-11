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

    return (packages ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.user_id) ?? null,
      display_name: profileMap.get(p.user_id)?.display_name ?? null,
      phone: profileMap.get(p.user_id)?.phone ?? null,
    }));
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      email: string;
      phone?: string;
      package: PackageKey;
      price_eur: number;
      start_date: string; // YYYY-MM-DD
      duration_days: number;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const origin =
      process.env.SITE_URL ||
      process.env.VITE_PUBLIC_SITE_URL ||
      "https://bodyfuel.app";

    // Invite per Magic Link. Trigger handle_new_user erstellt profile+user_roles.
    const { data: invited, error: invErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: {
          display_name: data.name,
          role: "client",
        },
        redirectTo: `${origin}/welcome`,
      });
    if (invErr) throw new Error(invErr.message);
    const newUserId = invited.user.id;

    // Phone in profile speichern
    if (data.phone) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: data.phone })
        .eq("id", newUserId);
    }

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

    return {
      profile: profile.data,
      email: userRes.data.user?.email ?? null,
      packages: pkgs.data ?? [],
      payments: payments.data ?? [],
    };
  });

export const updateCustomerPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      package_id: string;
      package?: PackageKey;
      price_eur?: number;
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
      end_date?: string;
      is_active?: boolean;
      notes?: string;
    } = {};
    if (data.package !== undefined) patch.package = data.package;
    if (data.price_eur !== undefined) patch.price_eur = data.price_eur;
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

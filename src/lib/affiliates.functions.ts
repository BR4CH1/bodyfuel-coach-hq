import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug: nur a-z, 0-9, Bindestrich");

const partnerPublicFields = "id, name, email, slug, commission_pct, is_active, notes, created_at, updated_at";

async function assertCoach(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (!data) throw new Error("Forbidden");
}

export const listAffiliatePartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: partners, error } = await supabaseAdmin
      .from("affiliate_partners")
      .select(partnerPublicFields)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const partnerIds = (partners ?? []).map((p) => p.id);
    if (partnerIds.length === 0) return [];

    const { data: refs } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("partner_id, commission_status, commission_amount_eur")
      .in("partner_id", partnerIds);

    const stats = new Map<string, { signups: number; payable_eur: number; paid_eur: number; converted: number }>();
    for (const p of partners ?? []) stats.set(p.id, { signups: 0, payable_eur: 0, paid_eur: 0, converted: 0 });
    for (const r of refs ?? []) {
      const s = stats.get(r.partner_id);
      if (!s) continue;
      s.signups += 1;
      if (r.commission_status === "payable" || r.commission_status === "paid") s.converted += 1;
      if (r.commission_status === "payable") s.payable_eur += Number(r.commission_amount_eur ?? 0);
      if (r.commission_status === "paid") s.paid_eur += Number(r.commission_amount_eur ?? 0);
    }

    return (partners ?? []).map((p) => ({ ...p, stats: stats.get(p.id)! }));
  });

export const createAffiliatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; email?: string; slug: string; commission_pct?: number; notes?: string }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        slug: slugSchema,
        commission_pct: z.number().min(0).max(100).default(10),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("affiliate_partners")
      .insert({
        name: data.name,
        email: data.email || null,
        slug: data.slug,
        commission_pct: data.commission_pct ?? 10,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select(partnerPublicFields)
      .single();
    if (error) {
      if (String(error.message).includes("duplicate")) throw new Error("Slug bereits vergeben");
      throw error;
    }
    return row;
  });

export const updateAffiliatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<{ name: string; email: string | null; commission_pct: number; is_active: boolean; notes: string | null }> }) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          name: z.string().trim().min(1).max(120).optional(),
          email: z.string().trim().email().max(255).nullable().optional(),
          commission_pct: z.number().min(0).max(100).optional(),
          is_active: z.boolean().optional(),
          notes: z.string().trim().max(1000).nullable().optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("affiliate_partners")
      .update(data.patch)
      .eq("id", data.id)
      .select(partnerPublicFields)
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAffiliatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("affiliate_partners").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listAffiliateReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: refs, error } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const userIds = [...new Set((refs ?? []).map((r) => r.referred_user_id))];
    const partnerIds = [...new Set((refs ?? []).map((r) => r.partner_id))];

    const [{ data: profiles }, { data: partners }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      partnerIds.length
        ? supabaseAdmin.from("affiliate_partners").select("id, name, slug").in("id", partnerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const partnerMap = new Map((partners ?? []).map((p) => [p.id, p]));

    return (refs ?? []).map((r) => ({
      ...r,
      customer_name: nameMap.get(r.referred_user_id) ?? null,
      partner_name: partnerMap.get(r.partner_id)?.name ?? null,
      partner_slug: partnerMap.get(r.partner_id)?.slug ?? null,
    }));
  });

export const markReferralPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("affiliate_referrals")
      .update({ commission_status: "paid", paid_at: new Date().toISOString(), payout_note: data.note ?? "manuell" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const voidReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("affiliate_referrals")
      .update({ commission_status: "void", payout_note: data.reason ?? "storniert" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Called from the client after sign-in, with the slug stored in localStorage. */
export const attachReferralForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("attach_referral", {
      _user_id: context.userId,
      _slug: data.slug,
    });
    if (error) throw error;
    return { ok: true };
  });

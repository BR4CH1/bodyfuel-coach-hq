import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genCode(): string {
  // 8 chars, exclude confusing 0/O/1/I
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const listGiftHubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("gift_hubs")
      .select("code, label, kind, description, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const listGiftCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("smart_gift_codes")
      .select("*, gift_hubs:hub_code(code, label, kind)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createGiftCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      label?: string;
      days?: number;
      max_uses?: number;
      expires_at?: string | null;
      hub_code?: string;
    }) =>
      z
        .object({
          label: z.string().trim().max(120).optional(),
          days: z.number().int().min(1).max(365).default(30),
          max_uses: z.number().int().min(1).max(10000).default(1),
          expires_at: z.string().nullable().optional(),
          hub_code: z.string().trim().min(1).max(64).default("smart"),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate hub
    const { data: hub } = await supabaseAdmin
      .from("gift_hubs")
      .select("code, is_active")
      .eq("code", data.hub_code ?? "smart")
      .maybeSingle();
    if (!hub || !hub.is_active) throw new Error("Unbekanntes oder inaktives Hub");

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode();
      const { data: row, error } = await supabaseAdmin
        .from("smart_gift_codes")
        .insert({
          code,
          label: data.label ?? null,
          days: data.days ?? 30,
          max_uses: data.max_uses ?? 1,
          expires_at: data.expires_at ?? null,
          created_by: userId,
          hub_code: hub.code,
        })
        .select()
        .single();
      if (!error) return row;
      if (!String(error.message).includes("duplicate")) throw error;
    }
    throw new Error("Konnte keinen freien Code generieren");
  });

export const deleteGiftCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("smart_gift_codes").delete().eq("code", data.code);
    if (error) throw error;
    return { ok: true };
  });

export const validateGiftCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("smart_gift_codes")
      .select("code, label, days, max_uses, uses, expires_at, hub_code, gift_hubs:hub_code(code, label, kind, group_name)")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!row) return { valid: false as const, reason: "Code unbekannt" };
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
      return { valid: false as const, reason: "Code abgelaufen" };
    if (row.uses >= row.max_uses)
      return { valid: false as const, reason: "Code bereits eingelöst" };
    const hub = (row as any).gift_hubs ?? null;
    return {
      valid: true as const,
      code: row.code,
      label: row.label,
      days: row.days,
      remaining: row.max_uses - row.uses,
      hub_code: row.hub_code ?? "smart",
      hub_label: hub?.label ?? "BodyFuel Smart",
      hub_kind: (hub?.kind ?? "smart") as "smart" | "group",
    };
  });

export const redeemGiftCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();

    const { data: row, error: rErr } = await supabaseAdmin
      .from("smart_gift_codes")
      .select("*, gift_hubs:hub_code(code, label, kind, group_name)")
      .eq("code", code)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) throw new Error("Code unbekannt");
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
      throw new Error("Code abgelaufen");
    if (row.uses >= row.max_uses) throw new Error("Code bereits eingelöst");

    // Prevent double-redemption by the same user
    const { data: already } = await supabaseAdmin
      .from("smart_gift_redemptions")
      .select("id")
      .eq("code", code)
      .eq("user_id", userId)
      .maybeSingle();
    if (already) throw new Error("Du hast diesen Code bereits eingelöst");

    const hub = (row as any).gift_hubs as {
      code: string;
      label: string;
      kind: "smart" | "group";
      group_name: string | null;
    } | null;
    const hubKind: "smart" | "group" = hub?.kind ?? "smart";

    const today = new Date();
    const end = new Date(today.getTime() + row.days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (hubKind === "smart") {
      // Upsert smart package — extend end_date if already exists
      const { data: existing } = await supabaseAdmin
        .from("customer_packages")
        .select("id, end_date")
        .eq("user_id", userId)
        .eq("package", "smart")
        .maybeSingle();

      if (existing) {
        const currentEnd = existing.end_date ? new Date(existing.end_date) : today;
        const base = currentEnd.getTime() > today.getTime() ? currentEnd : today;
        const newEnd = new Date(base.getTime() + row.days * 24 * 60 * 60 * 1000);
        const { error: uErr } = await supabaseAdmin
          .from("customer_packages")
          .update({
            is_active: true,
            status: "active",
            end_date: fmt(newEnd),
            source: "gift",
            notes: `Geschenk-Code ${code}${row.label ? ` (${row.label})` : ""}`,
          })
          .eq("id", existing.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabaseAdmin.from("customer_packages").insert({
          user_id: userId,
          package: "smart",
          price_eur: 0,
          start_date: fmt(today),
          end_date: fmt(end),
          is_active: true,
          status: "active",
          source: "gift",
          started_at: today.toISOString(),
          notes: `Geschenk-Code ${code}${row.label ? ` (${row.label})` : ""}`,
        });
        if (iErr) throw iErr;
      }
    } else if (hubKind === "group") {
      const groupName = hub?.group_name;
      if (!groupName) throw new Error("Hub falsch konfiguriert (group_name fehlt)");
      // Grant group membership (idempotent)
      const { error: gErr } = await supabaseAdmin
        .from("user_groups")
        .upsert(
          { user_id: userId, group_name: groupName as "bulls" | "premium" | "running_team" | "sgz" },
          { onConflict: "user_id,group_name" },
        );
      if (gErr) throw gErr;
    }

    const { error: incErr } = await supabaseAdmin
      .from("smart_gift_codes")
      .update({ uses: row.uses + 1 })
      .eq("code", code);
    if (incErr) throw incErr;

    await supabaseAdmin
      .from("smart_gift_redemptions")
      .insert({ code, user_id: userId });

    return { ok: true, days: row.days, hub_code: hub?.code ?? "smart", hub_kind: hubKind };
  });

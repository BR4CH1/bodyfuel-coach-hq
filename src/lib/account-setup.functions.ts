import { createServerFn } from "@tanstack/react-start";

async function lookup(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const { data } = await supabaseAdmin.from("account_setup_tokens").select("user_id, email").eq("token", token).maybeSingle();
  return data as { user_id: string; email: string } | null;
}

export const getAccountSetup = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const row = await lookup(data.token);
    if (!row) return { ok: false as const };
    return { ok: true as const, email: row.email };
  });

/** Setzt das Passwort für den Link-Inhaber und bestätigt die E-Mail. Link bleibt gültig. */
export const completeAccountSetup = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string }) => ({ token: String(d.token ?? ""), password: String(d.password ?? "") }))
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Das Passwort braucht mindestens 8 Zeichen.");
    const row = await lookup(data.token);
    if (!row) throw new Error("Dieser Link ist ungültig.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password, email_confirm: true });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("account_setup_tokens").update({ last_used_at: new Date().toISOString() } as any).eq("token", data.token);
    return { ok: true, email: row.email };
  });

/** Öffentlich: „Passwort vergessen" – verschickt den dauerhaften Link. Antwortet immer ok. */
export const requestAccountSetupLink = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => ({ email: String(d.email ?? "").trim().toLowerCase().slice(0, 254) }))
  .handler(async ({ data }) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Drossel: höchstens eine Mail pro Adresse alle 2 Minuten.
    const since = new Date(Date.now() - 120_000).toISOString();
    const { count } = await supabaseAdmin.from("email_send_log").select("id", { count: "exact", head: true })
      .eq("template_name", "account-setup").eq("recipient_email", data.email).gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: true };
    let user: { id: string; user_metadata?: any } | null = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      user = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email) ?? null;
      if (list.users.length < 1000) break;
    }
    if (!user) return { ok: true };
    const { sendAccountSetupEmail } = await import("@/lib/account-setup.server");
    const first = String(user.user_metadata?.first_name ?? "").split(/\s+/)[0] || undefined;
    await sendAccountSetupEmail(user.id, data.email, first, "/");
    return { ok: true };
  });

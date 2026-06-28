import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ConsentSchema = z.object({
  token: z.string().uuid(),
  guardian_name: z.string().trim().min(2).max(120),
  is_guardian: z.literal(true),
  agb: z.literal(true),
  datenschutz: z.literal(true),
  gesundheit: z.literal(true),
  widerruf: z.literal(true),
});

function getIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

export const Route = createFileRoute("/api/public/guardian-consent")({
  server: {
    handlers: {
      // Token validieren (für Eltern-UI)
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return Response.json({ valid: false, error: "missing_token" }, { status: 400 });

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "server_config" }, { status: 500 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: row } = await supabase
          .from("guardian_consent_tokens")
          .select("token, user_id, guardian_email, guardian_name, expires_at, consumed_at")
          .eq("token", token)
          .maybeSingle();

        if (!row) return Response.json({ valid: false, reason: "not_found" });
        if (row.consumed_at) return Response.json({ valid: false, reason: "already_used" });
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return Response.json({ valid: false, reason: "expired" });
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, birthdate")
          .eq("id", row.user_id)
          .maybeSingle();

        return Response.json({
          valid: true,
          guardian_email: row.guardian_email,
          guardian_name: row.guardian_name,
          minor_name: prof?.display_name ?? null,
          minor_birthdate: prof?.birthdate ?? null,
        });
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const parsed = ConsentSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
        }
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ ok: false, error: "server_config" }, { status: 500 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: row } = await supabase
          .from("guardian_consent_tokens")
          .select("token, user_id, guardian_email, expires_at, consumed_at")
          .eq("token", parsed.data.token)
          .maybeSingle();

        if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
        if (row.consumed_at) return Response.json({ ok: false, error: "already_used" }, { status: 410 });
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return Response.json({ ok: false, error: "expired" }, { status: 410 });
        }

        const now = new Date().toISOString();
        const ip = getIp(request);
        const docs = {
          agb: { confirmed: true, at: now, version: "v1" },
          datenschutz: { confirmed: true, at: now, version: "v1" },
          gesundheitsdaten: { confirmed: true, at: now, version: "v1" },
          widerruf: { confirmed: true, at: now, version: "v1" },
        };

        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            guardian_name: parsed.data.guardian_name,
            guardian_consent_at: now,
            guardian_consent_ip: ip,
            guardian_consent_docs: docs,
            account_status: "active",
          })
          .eq("id", row.user_id);
        if (pErr) return Response.json({ ok: false, error: pErr.message }, { status: 500 });

        await supabase
          .from("guardian_consent_tokens")
          .update({ consumed_at: now })
          .eq("token", row.token);

        return Response.json({ ok: true });
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SITE_NAME = "BODYFUEL";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";
const APP_URL = "https://bodyfuel-coaching.com";

/**
 * Speichert die Minderjährigen-Flags + erzeugt einen Eltern-Consent-Token
 * und stößt die Bestätigungs-E-Mail an die Eltern an. Der Account wird auf
 * `pending_guardian_consent` gesetzt, bis die Eltern den Link bestätigen.
 */
export const startGuardianConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    birthdate: string;
    guardianName?: string;
    guardianEmail?: string;
    minorName?: string;
  }) => {
    return z.object({
      birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      guardianName: z.string().trim().min(2).max(120).optional(),
      guardianEmail: z.string().trim().email().max(255).transform((s) => s.toLowerCase()).optional(),
      minorName: z.string().trim().max(120).optional(),
    }).parse(data);
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const today = new Date();
    const dob = new Date(data.birthdate);
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    const isMinor = age < 18;

    if (!isMinor) {
      // Nur Geburtsdatum speichern, Status bleibt aktiv
      await supabaseAdmin.from("profiles").update({
        birthdate: data.birthdate,
        is_minor: false,
        requires_guardian_consent: false,
        account_status: "active",
      }).eq("id", userId);
      return { ok: true, isMinor: false };
    }

    if (!data.guardianName || !data.guardianEmail) {
      return { ok: false, isMinor: true, error: "Eltern-Daten fehlen" };
    }

    // Profil als minderjährig markieren + Status auf pending
    await supabaseAdmin.from("profiles").update({
      birthdate: data.birthdate,
      is_minor: true,
      requires_guardian_consent: true,
      guardian_name: data.guardianName,
      guardian_email: data.guardianEmail,
      account_status: "pending_guardian_consent",
    }).eq("id", userId);

    // Token erzeugen
    const { data: token, error: tErr } = await supabaseAdmin
      .from("guardian_consent_tokens")
      .insert({
        user_id: userId,
        guardian_email: data.guardianEmail,
        guardian_name: data.guardianName,
      })
      .select("token")
      .single();
    if (tErr || !token) {
      return { ok: false, isMinor: true, error: tErr?.message ?? "Token-Erstellung fehlgeschlagen" };
    }

    // Profil-Name als Minor-Name
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const minorName = data.minorName ?? prof?.display_name ?? "Ihr Kind";

    // E-Mail rendern + enqueue
    const { TEMPLATES } = await import("@/lib/email-templates/registry");
    const React = await import("react");
    const { render } = await import("@react-email/components");

    const tpl = TEMPLATES["guardian-consent"];
    if (!tpl) return { ok: false, isMinor: true, error: "Template fehlt" };

    const consentUrl = `${APP_URL}/guardian-consent?token=${token.token}`;
    const payload = {
      minorName,
      guardianName: data.guardianName,
      consentUrl,
      siteName: SITE_NAME,
    };
    const element = React.createElement(tpl.component, payload);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(payload) : tpl.subject;
    const idempotencyKey = `guardian-consent:${userId}:${token.token}`;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: idempotencyKey,
      template_name: "guardian-consent",
      recipient_email: data.guardianEmail,
      status: "pending",
    });

    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: idempotencyKey,
        to: data.guardianEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "guardian-consent",
        idempotency_key: idempotencyKey,
        queued_at: new Date().toISOString(),
      },
    });

    return { ok: true, isMinor: true };
  });

/**
 * Erneut Eltern-Mail anstoßen (für Sperrhinweis-Karte).
 */
export const resendGuardianConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("birthdate, guardian_name, guardian_email, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.guardian_email || !prof?.guardian_name || !prof?.birthdate) {
      return { ok: false, error: "Keine Eltern-Daten hinterlegt" };
    }
    return await (startGuardianConsent as any)({
      data: {
        birthdate: prof.birthdate,
        guardianName: prof.guardian_name,
        guardianEmail: prof.guardian_email,
        minorName: prof.display_name ?? undefined,
      },
    });
  });

export const getMyGuardianStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select(
        "birthdate, is_minor, requires_guardian_consent, guardian_name, guardian_email, guardian_consent_at, guardian_consent_docs, account_status",
      )
      .eq("id", userId)
      .maybeSingle();
    return data;
  });

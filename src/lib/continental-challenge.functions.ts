/**
 * Continental × BodyFuel – 30 Tage Challenge
 *
 * Bewerbungsstrecke: öffentliche Bewerbung (pending) + Coach-Review.
 * KEINE automatische Account-/Organisationserstellung — nur Statusverwaltung.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CONTINENTAL_MAX_APPROVED = 25;

export const GOAL_TYPE_OPTIONS = [
  { value: "abnehmen", label: "Abnehmen" },
  { value: "muskeln_aufbauen", label: "Muskeln aufbauen" },
  { value: "fitter_werden", label: "Fitter werden" },
  { value: "gewohnheiten", label: "Gewohnheiten verbessern" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const GOAL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GOAL_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export type ContinentalApplicationStatus = "pending" | "approved" | "rejected";

export type SubmitContinentalResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "duplicate" | "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9 ()\/.-]{4,40}$/;

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nur für Coaches.");
}

/* ---------------- ÖFFENTLICH: Bewerbung absenden ---------------- */

export const submitContinentalApplication = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      age?: number | null;
      goal_type?: string | null;
      goal_text: string;
      motivation: string;
      privacy_consent: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<SubmitContinentalResult> => {
    const invalid = (message: string): SubmitContinentalResult => ({
      ok: false,
      code: "invalid",
      message,
    });

    const firstName = (data.first_name ?? "").trim();
    const lastName = (data.last_name ?? "").trim();
    const email = (data.email ?? "").trim().toLowerCase();
    const phone = (data.phone ?? "").trim();
    const goalText = (data.goal_text ?? "").trim();
    const motivation = (data.motivation ?? "").trim();

    if (firstName.length < 2 || firstName.length > 80) {
      return invalid("Bitte gib deinen Vornamen an.");
    }
    if (lastName.length < 2 || lastName.length > 80) {
      return invalid("Bitte gib deinen Nachnamen an.");
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return invalid("Bitte gib eine gültige E-Mail-Adresse an.");
    }
    if (!PHONE_RE.test(phone)) {
      return invalid("Bitte gib eine gültige Mobilnummer an.");
    }
    if (goalText.length < 5 || goalText.length > 2000) {
      return invalid("Bitte beschreibe kurz, was du in den 30 Tagen erreichen möchtest.");
    }
    if (motivation.length < 5 || motivation.length > 2000) {
      return invalid("Bitte beschreibe kurz, warum du bei der Challenge dabei sein möchtest.");
    }
    if (data.privacy_consent !== true) {
      return invalid("Bitte bestätige die Einwilligung zur Datenverarbeitung.");
    }

    let age: number | null = null;
    if (data.age !== undefined && data.age !== null) {
      const parsed = Math.round(Number(data.age));
      if (!Number.isFinite(parsed) || parsed < 14 || parsed > 99) {
        return invalid("Bitte gib ein gültiges Alter zwischen 14 und 99 an.");
      }
      age = parsed;
    }

    let goalType: string | null = null;
    if (data.goal_type) {
      const allowed = GOAL_TYPE_OPTIONS.some((o) => o.value === data.goal_type);
      if (!allowed) return invalid("Bitte wähle ein gültiges Hauptziel.");
      goalType = data.goal_type;
    }

    const duplicateResult: SubmitContinentalResult = {
      ok: false,
      code: "duplicate",
      message:
        "Für diese E-Mail-Adresse liegt bereits eine Bewerbung vor. Du musst nichts weiter tun — wir melden uns, sobald die Auswahl abgeschlossen ist.",
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("id")
      .eq("email", email)
      .in("status", ["pending", "approved"])
      .limit(1);
    if (!existingError && (existing ?? []).length > 0) {
      return duplicateResult;
    }

    const { error } = await supabaseAdmin.from("continental_challenge_applications").insert({
      first_name: firstName.slice(0, 80),
      last_name: lastName.slice(0, 80),
      email: email.slice(0, 200),
      phone: phone.slice(0, 40),
      age,
      goal_type: goalType,
      goal_text: goalText.slice(0, 2000),
      motivation: motivation.slice(0, 2000),
      privacy_consent: true,
      status: "pending",
    });

    if (error) {
      // Partieller Unique-Index auf lower(email) für aktive Bewerbungen.
      if (error.code === "23505") return duplicateResult;
      console.error("[continental-challenge] insert failed", error);
      return {
        ok: false,
        code: "error",
        message:
          "Deine Bewerbung konnte gerade nicht gespeichert werden. Bitte versuche es in ein paar Minuten erneut.",
      };
    }

    try {
      const { isCoachPushConfigured, notifyEnabledCoaches } =
        await import("@/lib/coach-push.server");
      if (isCoachPushConfigured()) {
        await notifyEnabledCoaches({
          title: "Neue Challenge-Bewerbung",
          body: `${firstName} ${lastName} hat sich für die Continental Challenge beworben.`,
          url: "/coach/continental-challenge",
          tag: `continental-application-${Date.now()}`,
        });
      }
    } catch (pushError) {
      console.warn("[coach-push] continental application notification failed", pushError);
    }

    return { ok: true };
  });

/* ---------------- COACH: Bewerbungen verwalten ---------------- */

export const listContinentalApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export type ReviewContinentalResult =
  | { ok: true }
  | { ok: false; code: "capacity"; message: string };

export const reviewContinentalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; decision: "approved" | "rejected" }) => data)
  .handler(async ({ data, context }): Promise<ReviewContinentalResult> => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rpcData, error } = await supabaseAdmin.rpc("review_continental_application", {
      _id: data.id,
      _decision: data.decision,
      _reviewer: context.userId,
    });
    if (error) throw new Error(error.message);

    const result = (rpcData ?? {}) as { ok?: boolean; code?: string };
    if (result.ok !== true) {
      if (result.code === "capacity") {
        return {
          ok: false,
          code: "capacity",
          message: `Alle ${CONTINENTAL_MAX_APPROVED} Plätze sind bereits vergeben. Es kann keine weitere Bewerbung angenommen werden.`,
        };
      }
      throw new Error("Bewerbung konnte nicht aktualisiert werden.");
    }

    return { ok: true };
  });

export const updateContinentalApplicationNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; notes: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const notes = (data.notes ?? "").trim().slice(0, 4000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("continental_challenge_applications")
      .update({ internal_notes: notes.length ? notes : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

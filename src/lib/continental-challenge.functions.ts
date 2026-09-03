/**
 * Continental × BodyFuel – 30 Tage Challenge
 *
 * Bewerbungsstrecke: öffentliche Bewerbung (pending) + Coach-Review.
 * Nach Freigabe wird KEIN Account automatisch erstellt. Stattdessen erhält
 * die Person eine normale Athleten-Einladung zur Performance-Organisation.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CONTINENTAL_MAX_APPROVED = 25;
export const CONTINENTAL_ORG_SLUG = "continental";
export const CONTINENTAL_ORG_NAME = "Continental";

const CONTINENTAL_FEATURES = [
  "home",
  "nutrition",
  "smart_nutrition",
  "recipes",
  "shopping_list",
  "athletic_training",
  "training",
  "smart_training",
  "checkins",
  "onboarding",
  "body_metrics",
  "progress_tracking",
  "community",
  "gamification",
  "challenges",
  "ranking",
  "analytics",
] as const;

export const GOAL_TYPE_OPTIONS = [
  { value: "abnehmen", label: "Gewicht reduzieren" },
  { value: "fitter_werden", label: "Fitter und leistungsfähiger werden" },
  { value: "muskeln_aufbauen", label: "Muskeln aufbauen" },
  { value: "ernaehrung", label: "Meine Ernährung verbessern" },
  { value: "regelmaessig_sport", label: "Wieder regelmäßig Sport treiben" },
  { value: "gesuender_leben", label: "Allgemein gesünder leben" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const GOAL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GOAL_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const ACTIVITY_LEVEL_OPTIONS = [
  { value: "kaum", label: "Aktuell kaum / gar nicht" },
  { value: "1x", label: "1× pro Woche" },
  { value: "2_3x", label: "2–3× pro Woche" },
  { value: "4x_plus", label: "4× oder häufiger pro Woche" },
] as const;

export const ACTIVITY_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

export const BLOCKER_OPTIONS = [
  { value: "motivation", label: "Fehlende Motivation" },
  { value: "trainingsplan", label: "Fehlender Trainingsplan" },
  { value: "ernaehrung", label: "Ernährung" },
  { value: "zeit", label: "Zeitmangel" },
  { value: "unterstuetzung", label: "Fehlende Unterstützung" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const BLOCKER_LABELS: Record<string, string> = Object.fromEntries(
  BLOCKER_OPTIONS.map((o) => [o.value, o.label]),
);

export const INSURANCE_REVIEW_OPTIONS = [
  { value: "letzte_12_monate", label: "Innerhalb der letzten 12 Monate" },
  { value: "1_3_jahre", label: "Vor 1–3 Jahren" },
  { value: "ueber_3_jahre", label: "Länger als 3 Jahre her" },
  { value: "noch_nie", label: "Noch nie" },
  { value: "weiss_nicht", label: "Weiß ich nicht" },
] as const;

export const INSURANCE_REVIEW_LABELS: Record<string, string> = Object.fromEntries(
  INSURANCE_REVIEW_OPTIONS.map((o) => [o.value, o.label]),
);

export const INSURANCE_TOPIC_OPTIONS = [
  { value: "bestehende_vertraege", label: "Bestehende Versicherungen & Beiträge" },
  { value: "einkommen", label: "Absicherung meines Einkommens" },
  { value: "familie", label: "Absicherung meiner Familie" },
  { value: "unfall", label: "Unfallabsicherung" },
  { value: "kranken", label: "Kranken-/Zusatzversicherung" },
  { value: "altersvorsorge", label: "Altersvorsorge & Vermögensaufbau" },
  { value: "eigentum", label: "Absicherung von Haus/Eigentum" },
  { value: "ueberblick", label: "Ich möchte einfach wissen, ob ich gut aufgestellt bin" },
] as const;

export const INSURANCE_TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  INSURANCE_TOPIC_OPTIONS.map((o) => [o.value, o.label]),
);

export const INSURANCE_PRIORITY_OPTIONS = [
  { value: "bessere_leistungen", label: "Bessere Leistungen" },
  { value: "beitraege_reduzieren", label: "Beiträge reduzieren" },
  { value: "versorgungsluecken", label: "Versorgungslücken erkennen" },
  { value: "familie_absichern", label: "Meine Familie besser absichern" },
  { value: "altersvorsorge", label: "Altersvorsorge verbessern" },
  { value: "ueberblick", label: "Erst einmal einen Überblick bekommen" },
] as const;

export const INSURANCE_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  INSURANCE_PRIORITY_OPTIONS.map((o) => [o.value, o.label]),
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

async function isPlatformOwner(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_owner",
  });
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Legt Continental einmalig als normale Performance-Organisation an.
 * Besteht sie bereits, wird nichts dupliziert.
 */
async function ensureContinentalOrganization(supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, organization_type, status, max_customers")
    .eq("slug", CONTINENTAL_ORG_SLUG)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as any;

  if (!(await isPlatformOwner(supabase, userId))) {
    throw new Error(
      "Die Continental Performance-Organisation muss einmalig von einem Plattform-Owner initialisiert werden.",
    );
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: CONTINENTAL_ORG_NAME,
      short_name: CONTINENTAL_ORG_NAME,
      slug: CONTINENTAL_ORG_SLUG,
      organization_type: "company" as any,
      status: "active",
      claim: "30 Tage. Ein Ziel. Deine Challenge.",
      license_plan: "custom",
      license_status: "active",
      max_customers: CONTINENTAL_MAX_APPROVED,
      max_coaches: 5,
    } as any)
    .select("id, name, slug, organization_type, status, max_customers")
    .single();

  if (createError) {
    // Parallelaufruf: falls der Slug inzwischen angelegt wurde, vorhandene Org nutzen.
    if (createError.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("organizations")
        .select("id, name, slug, organization_type, status, max_customers")
        .eq("slug", CONTINENTAL_ORG_SLUG)
        .maybeSingle();
      if (raced) return raced as any;
    }
    throw new Error(createError.message);
  }

  const orgId = (created as any).id as string;

  const { data: existingStaff } = await supabaseAdmin
    .from("staff_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1);
  if ((existingStaff ?? []).length === 0) {
    const { error: staffError } = await supabaseAdmin.from("staff_assignments").insert({
      user_id: userId,
      organization_id: orgId,
      team_id: null,
      role: "organization_admin" as any,
      permissions: [],
    } as any);
    if (staffError) throw new Error(staffError.message);
  }

  const featureRows = CONTINENTAL_FEATURES.map((feature) => ({
    organization_id: orgId,
    feature,
    enabled: true,
  }));
  const { error: featuresError } = await supabaseAdmin
    .from("organization_features")
    .upsert(featureRows as any, { onConflict: "organization_id,feature" } as any);
  if (featuresError) throw new Error(featuresError.message);

  return created as any;
}

async function findLatestContinentalInvite(orgId: string, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("organization_invites")
    .select("id, invite_token, status, created_at")
    .eq("organization_id", orgId)
    .eq("email", email.toLowerCase().trim())
    .eq("assigned_role", "athlete" as any)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as any;
}

async function ensureContinentalAthleteInvite(
  orgId: string,
  email: string,
  createdBy: string,
): Promise<{ id: string; token: string; status: string; created: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await findLatestContinentalInvite(orgId, normalizedEmail);
  if (existing && (existing.status === "pending" || existing.status === "accepted")) {
    return {
      id: existing.id,
      token: existing.invite_token,
      status: existing.status,
      created: false,
    };
  }

  const inviteToken = crypto.randomUUID().replace(/-/g, "");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: invite, error } = await supabaseAdmin
    .from("organization_invites")
    .insert({
      organization_id: orgId,
      email: normalizedEmail,
      assigned_role: "athlete" as any,
      team_id: null,
      permissions: [],
      created_by: createdBy,
      invite_token: inviteToken,
      status: "pending" as any,
      expires_at: null,
    } as any)
    .select("id, invite_token, status")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: (invite as any).id,
    token: (invite as any).invite_token,
    status: (invite as any).status,
    created: true,
  };
}

/* ---------------- ÖFFENTLICH: Bewerbung absenden ---------------- */

export type SubmitContinentalInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_year: number | null;
  city: string;
  goal_type: string;
  goal_other?: string | null;
  activity_level: string;
  motivation: string;
  blockers: string[];
  blocker_other?: string | null;
  insurance_last_review?: string | null;
  insurance_topics?: string[];
  insurance_priorities?: string[];
  insurance_notes?: string | null;
  privacy_consent: boolean;
  financial_contact_consent: boolean;
};

const CURRENT_YEAR = () => new Date().getFullYear();

function sanitizeChoices(
  values: unknown,
  allowed: ReadonlyArray<{ value: string }>,
): string[] {
  if (!Array.isArray(values)) return [];
  const set = new Set(allowed.map((o) => o.value));
  return Array.from(new Set(values.filter((v): v is string => typeof v === "string" && set.has(v))));
}

export const submitContinentalApplication = createServerFn({ method: "POST" })
  .inputValidator((data: SubmitContinentalInput) => data)
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
    const city = (data.city ?? "").trim();
    const motivation = (data.motivation ?? "").trim();
    const goalOther = (data.goal_other ?? "").trim();
    const blockerOther = (data.blocker_other ?? "").trim();
    const insuranceNotes = (data.insurance_notes ?? "").trim();

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
      return invalid("Bitte gib eine gültige Telefonnummer an.");
    }
    if (city.length < 2 || city.length > 120) {
      return invalid("Bitte gib deinen Wohnort an.");
    }

    const year = CURRENT_YEAR();
    const birthYear = Math.round(Number(data.birth_year));
    if (!Number.isFinite(birthYear) || birthYear < year - 99 || birthYear > year - 14) {
      return invalid("Bitte gib ein plausibles Geburtsjahr an (Mindestalter 14 Jahre).");
    }

    const goalType = (data.goal_type ?? "").trim();
    if (!GOAL_TYPE_OPTIONS.some((o) => o.value === goalType)) {
      return invalid("Bitte wähle dein Hauptziel aus.");
    }
    if (goalType === "sonstiges" && goalOther.length < 3) {
      return invalid("Bitte beschreibe kurz dein sonstiges Ziel.");
    }

    const activityLevel = (data.activity_level ?? "").trim();
    if (!ACTIVITY_LEVEL_OPTIONS.some((o) => o.value === activityLevel)) {
      return invalid("Bitte wähle aus, wie oft du aktuell aktiv bist.");
    }

    if (motivation.length < 5 || motivation.length > 2000) {
      return invalid("Bitte beschreibe kurz, warum du bei der Challenge dabei sein möchtest.");
    }

    const blockers = sanitizeChoices(data.blockers, BLOCKER_OPTIONS);
    if (blockers.length === 0) {
      return invalid("Bitte wähle mindestens ein Hindernis aus.");
    }
    if (blockers.includes("sonstiges") && blockerOther.length < 3) {
      return invalid("Bitte beschreibe kurz dein sonstiges Hindernis.");
    }

    if (data.privacy_consent !== true) {
      return invalid("Bitte bestätige die Einwilligung zur Datenverarbeitung.");
    }

    let insuranceLastReview: string | null = null;
    if (data.insurance_last_review) {
      if (!INSURANCE_REVIEW_OPTIONS.some((o) => o.value === data.insurance_last_review)) {
        return invalid("Bitte wähle eine gültige Angabe zum letzten Versicherungs-Check.");
      }
      insuranceLastReview = data.insurance_last_review;
    }
    const insuranceTopics = sanitizeChoices(data.insurance_topics, INSURANCE_TOPIC_OPTIONS);
    const insurancePriorities = sanitizeChoices(data.insurance_priorities, INSURANCE_PRIORITY_OPTIONS);

    const goalLabel = GOAL_TYPE_LABELS[goalType] ?? goalType;
    const goalText = goalType === "sonstiges" && goalOther ? `${goalLabel}: ${goalOther}` : goalLabel;

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
      age: year - birthYear,
      birth_year: birthYear,
      city: city.slice(0, 120),
      goal_type: goalType,
      goal_other: goalOther ? goalOther.slice(0, 500) : null,
      goal_text: goalText.slice(0, 2000),
      activity_level: activityLevel,
      motivation: motivation.slice(0, 2000),
      blockers,
      blocker_other: blockerOther ? blockerOther.slice(0, 500) : null,
      insurance_last_review: insuranceLastReview,
      insurance_topics: insuranceTopics,
      insurance_priorities: insurancePriorities,
      insurance_notes: insuranceNotes ? insuranceNotes.slice(0, 2000) : null,
      financial_contact_consent: data.financial_contact_consent === true,
      privacy_consent: true,
      status: "pending",
    } as never);



    if (error) {
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
    const organization = await ensureContinentalOrganization(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const emails = Array.from(
      new Set((data ?? []).map((row: any) => String(row.email ?? "").toLowerCase()).filter(Boolean)),
    );
    const inviteByEmail = new Map<string, any>();
    if (emails.length > 0) {
      const { data: invites, error: inviteError } = await supabaseAdmin
        .from("organization_invites")
        .select("id, email, invite_token, status, created_at")
        .eq("organization_id", (organization as any).id)
        .eq("assigned_role", "athlete" as any)
        .in("email", emails)
        .order("created_at", { ascending: false });
      if (inviteError) throw new Error(inviteError.message);
      for (const invite of (invites ?? []) as any[]) {
        const key = String(invite.email ?? "").toLowerCase();
        if (key && !inviteByEmail.has(key)) inviteByEmail.set(key, invite);
      }
    }

    return (data ?? []).map((row: any) => {
      const invite = inviteByEmail.get(String(row.email ?? "").toLowerCase());
      return {
        ...row,
        performance_org_id: (organization as any).id,
        performance_org_slug: (organization as any).slug,
        performance_invite_status: invite?.status ?? null,
        performance_invite_path: invite?.invite_token
          ? `/${(organization as any).slug}/invite/${invite.invite_token}`
          : null,
      };
    });
  });

export type ReviewContinentalResult =
  | { ok: true; invite_path?: string | null; invite_status?: string | null }
  | { ok: false; code: "capacity"; message: string };

export const reviewContinentalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; decision: "approved" | "rejected" }) => data)
  .handler(async ({ data, context }): Promise<ReviewContinentalResult> => {
    await assertCoach(context.supabase, context.userId);
    const organization = await ensureContinentalOrganization(context.supabase, context.userId);
    const orgId = (organization as any).id as string;
    const orgSlug = (organization as any).slug as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: application, error: appError } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("id, email, status")
      .eq("id", data.id)
      .maybeSingle();
    if (appError) throw new Error(appError.message);
    if (!application) throw new Error("Bewerbung nicht gefunden.");

    const email = String((application as any).email ?? "").toLowerCase().trim();
    const currentInvite = await findLatestContinentalInvite(orgId, email);

    if (data.decision === "rejected" && currentInvite?.status === "accepted") {
      throw new Error(
        "Die Person ist bereits der Performance-Organisation beigetreten. Entferne sie bei Bedarf direkt im Performance-Cockpit.",
      );
    }

    let provisionedInvite:
      | { id: string; token: string; status: string; created: boolean }
      | null = null;
    if (data.decision === "approved") {
      provisionedInvite = await ensureContinentalAthleteInvite(orgId, email, context.userId);
    }

    const { data: rpcData, error } = await supabaseAdmin.rpc("review_continental_application", {
      _id: data.id,
      _decision: data.decision,
      _reviewer: context.userId,
    });
    if (error) {
      if (provisionedInvite?.created) {
        await supabaseAdmin
          .from("organization_invites")
          .update({ status: "revoked" as any })
          .eq("id", provisionedInvite.id);
      }
      throw new Error(error.message);
    }

    const result = (rpcData ?? {}) as { ok?: boolean; code?: string };
    if (result.ok !== true) {
      if (provisionedInvite?.created) {
        await supabaseAdmin
          .from("organization_invites")
          .update({ status: "revoked" as any })
          .eq("id", provisionedInvite.id);
      }
      if (result.code === "capacity") {
        return {
          ok: false,
          code: "capacity",
          message: `Alle ${CONTINENTAL_MAX_APPROVED} Plätze sind bereits vergeben. Es kann keine weitere Bewerbung angenommen werden.`,
        };
      }
      throw new Error("Bewerbung konnte nicht aktualisiert werden.");
    }

    if (data.decision === "rejected" && currentInvite?.status === "pending") {
      await supabaseAdmin
        .from("organization_invites")
        .update({ status: "revoked" as any })
        .eq("id", currentInvite.id);
    }

    return data.decision === "approved" && provisionedInvite
      ? {
          ok: true,
          invite_status: provisionedInvite.status,
          invite_path: `/${orgSlug}/invite/${provisionedInvite.token}`,
        }
      : { ok: true };
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

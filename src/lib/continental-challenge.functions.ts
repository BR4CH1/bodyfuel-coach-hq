/**
 * Continental × BodyFuel – 30 Tage Challenge
 *
 * Bewerbungsstrecke: öffentliche Bewerbung (pending) + Coach-Review.
 * Nach Freigabe erhält die Person einen regulären BodyFuel-Smart-Zugang
 * (Kundenrolle, Smart-Paket für die Challenge-Dauer, normales Onboarding,
 * Ranking). Performance-Einladungen werden nicht mehr verwendet.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CONTINENTAL_MAX_APPROVED = 25;
export const CONTINENTAL_ORG_SLUG = "continental";
export const CONTINENTAL_ORG_NAME = "Continental";
/** Challenge-Zeitraum: Smart-Zugang ab Start für 30 Tage. */
export const CONTINENTAL_CHALLENGE_START = "2026-11-15";
export const CONTINENTAL_CHALLENGE_DAYS = 30;
export const CONTINENTAL_PACKAGE_MARKER = "[Continentale Challenge]";
export const CONTINENTAL_GROUP = "continental";

export function continentalPackageWindow(today: string) {
  // Zugang sofort ab Freigabe (Onboarding vor dem Start), Ende = Challenge-Ende.
  const start = today;
  const end = new Date(`${CONTINENTAL_CHALLENGE_START}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + CONTINENTAL_CHALLENGE_DAYS);
  return { start_date: start, end_date: end.toISOString().slice(0, 10) };
}

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


type SmartAccessStatus = "none" | "invited" | "active";

async function findAuthUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Revoked offene Performance-Einladungen (Altbestand) – ohne Org anzulegen. */
async function revokeContinentalPerformanceInvites(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", CONTINENTAL_ORG_SLUG)
    .maybeSingle();
  if (!org) return;
  await supabaseAdmin
    .from("organization_invites")
    .update({ status: "revoked" as any })
    .eq("organization_id", (org as any).id)
    .eq("email", email)
    .eq("status", "pending" as any);
}

/**
 * Regulärer Smart-Zugang (identisch zum Coach-Kundenanlegen): Einladung per
 * Mail → /welcome (Onboarding), Rolle client, Smart-Paket 0 € für die
 * Challenge-Dauer, Gruppe "continental". Idempotent.
 */
async function provisionContinentalSmartAccess(
  application: { email: string; first_name: string; last_name: string; phone: string | null },
  opts: { resend?: boolean } = {},
): Promise<{ user_id: string; invited: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = application.email.toLowerCase().trim();
  const firstName = application.first_name.trim().split(/\s+/)[0] ?? "";
  const lastName = application.last_name.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  const existing = await findAuthUserByEmail(email);
  let userId: string;
  let invited = false;
  if (existing) {
    userId = existing.id;
    const neverSignedIn = !existing.last_sign_in_at;
    if (opts.resend || neverSignedIn) {
      const { sendAccountSetupEmail } = await import("@/lib/account-setup.server");
      await sendAccountSetupEmail(userId, email, firstName);
      invited = true;
    }
  } else {
    await supabaseAdmin.from("leads").insert({
      name: displayName,
      email,
      phone: application.phone || null,
      desired_package: null,
      status: "converted",
      message: `${CONTINENTAL_PACKAGE_MARKER} Teilnahme freigegeben`,
    } as any);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        full_name: displayName,
        name: displayName,
        created_via: "coach",
        role: "client",
      },
    });
    if (error) throw new Error(error.message);
    userId = data.user.id;
    const { sendAccountSetupEmail } = await import("@/lib/account-setup.server");
    await sendAccountSetupEmail(userId, email, firstName);
    invited = true;
  }

  // Kundenrolle sicherstellen (Ranking zählt Rolle client).
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "client" } as any, { onConflict: "user_id,role" } as any);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, phone")
    .eq("id", userId)
    .maybeSingle();
  await supabaseAdmin
    .from("profiles")
    .update({
      display_name: (profile as any)?.display_name || displayName,
      phone: (profile as any)?.phone || application.phone || null,
    } as any)
    .eq("id", userId);

  const { data: activePkgs } = await supabaseAdmin
    .from("customer_packages")
    .select("id, notes, end_date")
    .eq("user_id", userId)
    .eq("is_active", true);
  const window = continentalPackageWindow(new Date().toISOString().slice(0, 10));
  const hasContinental = (activePkgs ?? []).some((p: any) =>
    String(p.notes ?? "").includes(CONTINENTAL_PACKAGE_MARKER),
  );
  // Bestehende bezahlte Pakete werden NICHT angetastet.
  if (!hasContinental && (activePkgs ?? []).length === 0) {
    const { error: pkgErr } = await supabaseAdmin.from("customer_packages").upsert(
      {
        user_id: userId,
        package: "smart",
        price_eur: 0,
        start_date: window.start_date,
        end_date: window.end_date,
        is_active: true,
        notes: `${CONTINENTAL_PACKAGE_MARKER} 30 Tage Smart, kostenlos`,
      } as any,
      { onConflict: "user_id,package" } as any,
    );
    if (pkgErr) throw new Error(pkgErr.message);
  }

  await supabaseAdmin
    .from("user_groups")
    .upsert({ user_id: userId, group_name: CONTINENTAL_GROUP } as any, {
      onConflict: "user_id,group_name",
    } as any);

  await revokeContinentalPerformanceInvites(email);
  return { user_id: userId, invited };
}

async function deactivateContinentalSmartAccess(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const user = await findAuthUserByEmail(email);
  if (!user) return;
  await supabaseAdmin
    .from("customer_packages")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true)
    .like("notes", `${CONTINENTAL_PACKAGE_MARKER}%`);
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
          body: `${firstName} ${lastName} hat sich für die Continentale Challenge beworben.`,
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

    const emails = new Set(
      (data ?? []).map((row: any) => String(row.email ?? "").toLowerCase()).filter(Boolean),
    );
    const userByEmail = new Map<string, { id: string; last_sign_in_at: string | null }>();
    for (let page = 1; page <= 20 && emails.size > userByEmail.size; page++) {
      const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (usersError) throw new Error(usersError.message);
      for (const u of users.users) {
        const key = (u.email ?? "").toLowerCase();
        if (emails.has(key)) userByEmail.set(key, { id: u.id, last_sign_in_at: u.last_sign_in_at ?? null });
      }
      if (users.users.length < 1000) break;
    }
    const userIds = Array.from(userByEmail.values()).map((u) => u.id);
    const activePkgUsers = new Set<string>();
    if (userIds.length > 0) {
      const { data: pkgs } = await supabaseAdmin
        .from("customer_packages")
        .select("user_id")
        .in("user_id", userIds)
        .eq("is_active", true);
      for (const p of (pkgs ?? []) as any[]) activePkgUsers.add(p.user_id);
    }

    return (data ?? []).map((row: any) => {
      const user = userByEmail.get(String(row.email ?? "").toLowerCase());
      let smart_status: SmartAccessStatus = "none";
      if (user && activePkgUsers.has(user.id)) {
        smart_status = user.last_sign_in_at ? "active" : "invited";
      }
      return { ...row, smart_user_id: user?.id ?? null, smart_status };
    });
  });

export type ReviewContinentalResult =
  | { ok: true; smart_invited?: boolean }
  | { ok: false; code: "capacity"; message: string };

export const reviewContinentalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; decision: "approved" | "rejected" }) => data)
  .handler(async ({ data, context }): Promise<ReviewContinentalResult> => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: application, error: appError } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("id, email, status, first_name, last_name, phone")
      .eq("id", data.id)
      .maybeSingle();
    if (appError) throw new Error(appError.message);
    if (!application) throw new Error("Bewerbung nicht gefunden.");

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

    const email = String((application as any).email ?? "").toLowerCase().trim();
    if (data.decision === "approved") {
      const res = await provisionContinentalSmartAccess(application as any);
      return { ok: true, smart_invited: res.invited };
    }
    await deactivateContinentalSmartAccess(email);
    await revokeContinentalPerformanceInvites(email);
    return { ok: true };
  });

/** Smart-Zugang für bereits angenommene Bewerbungen einrichten bzw. Einladung erneut senden. */
export const sendContinentalSmartAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: application, error } = await supabaseAdmin
      .from("continental_challenge_applications")
      .select("id, email, status, first_name, last_name, phone")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!application) throw new Error("Bewerbung nicht gefunden.");
    if ((application as any).status !== "approved") {
      throw new Error("Nur angenommene Bewerbungen erhalten einen Smart-Zugang.");
    }
    const res = await provisionContinentalSmartAccess(application as any, { resend: true });
    return { ok: true, invited: res.invited };
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

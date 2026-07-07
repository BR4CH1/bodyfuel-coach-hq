import { createServerFn, getRequest } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Roster-Management für Vereine.
 *
 * Permission-Modell (aktuell bewusst kompakt):
 * - organization_admin (public.is_org_admin) → darf immer.
 * - staff.role='coach' mit 'manage_organization' Permission (Head Coach) →
 *   darf für die ganze Organisation.
 * - staff.role='coach' ohne 'manage_organization' (Team Coach) → darf nur,
 *   wenn 'invite_athletes' explizit in permissions steht UND team_id zum
 *   staff_assignment.team_id passt (oder das assignment ist ohne team_id
 *   und damit org-weit).
 * - Alles andere: verweigert.
 *
 * Architektonisch getrennt gehalten sind:
 *   - invite_athletes  (Neue Athleten einladen / manuell anlegen)
 *   - edit_roster      (Position/Trikotnummer/Team ändern) — noch nicht separat geprüft
 *   - remove_athletes  (Aus Team entfernen) — noch nicht separat geprüft
 * Aktuell nutzt die UI eine einheitliche `can_manage` Prüfung; bei Bedarf
 * lassen sich später getrennte Capabilities einführen ohne API-Break.
 */

type PermCtx = {
  supabase: any;
  userId: string;
  organization_id: string;
  team_id?: string | null;
};

async function assertCanManageRoster(ctx: PermCtx): Promise<void> {
  const { supabase, userId, organization_id, team_id } = ctx;
  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    _user: userId,
    _org: organization_id,
  });
  if (isAdmin) return;

  const { data: sas } = await supabase
    .from("staff_assignments")
    .select("role, permissions, team_id")
    .eq("user_id", userId)
    .eq("organization_id", organization_id);

  const rows = (sas ?? []) as Array<{ role: string; permissions: string[] | null; team_id: string | null }>;
  const headCoach = rows.find(
    (r) => r.role === "coach" && (r.permissions ?? []).includes("manage_organization"),
  );
  if (headCoach) return;

  const teamCoach = rows.find(
    (r) =>
      r.role === "coach" &&
      (r.permissions ?? []).includes("invite_athletes") &&
      (r.team_id === null || r.team_id === team_id),
  );
  if (teamCoach) return;

  throw new Error("Keine Berechtigung, den Kader dieses Vereins zu verwalten.");
}

/** UI-seitige Prüfung: darf der aktuelle User den Kader (der Org) verwalten? */
export const canManageRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    try {
      await assertCanManageRoster({
        supabase: context.supabase,
        userId: context.userId,
        organization_id: data.organization_id,
        team_id: data.team_id ?? null,
      });
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

/** Athleten-Einladung erstellen. Nutzt organization_invites (assigned_role='athlete'). */
export const createAthleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      email: string;
      primary_position?: string | null;
      secondary_position?: string | null;
      jersey_number?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertCanManageRoster({ supabase, userId, organization_id: data.organization_id, team_id: data.team_id });

    const email = data.email.toLowerCase().trim();
    if (!email || !email.includes("@")) throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");

    const inviteToken = crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id,
        email,
        assigned_role: "athlete" as any,
        permissions: [] as any,
        invite_token: inviteToken,
        status: "pending" as any,
        created_by: userId,
        athlete_primary_position: data.primary_position ?? null,
        athlete_secondary_position: data.secondary_position ?? null,
        athlete_jersey_number: data.jersey_number ?? null,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Best-effort: transaktionale E-Mail versenden. Fehler brechen nicht ab.
    try {
      const [{ data: org }, { data: team }, { data: inviter }] = await Promise.all([
        supabase.from("organizations").select("slug, name").eq("id", data.organization_id).maybeSingle(),
        supabase.from("organization_teams").select("name").eq("id", data.team_id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      ]);
      const request = getRequest();
      const origin =
        request?.headers.get("origin") ??
        (() => {
          const host = request?.headers.get("host");
          const proto = request?.headers.get("x-forwarded-proto") ?? "https";
          return host ? `${proto}://${host}` : "https://bodyfuel-coaching.com";
        })();
      const inviteUrl = (org as any)?.slug
        ? `${origin}/${(org as any).slug}/invite/${inviteToken}`
        : `${origin}/invite/${inviteToken}`;
      const authHeader = request?.headers.get("authorization");
      if (authHeader) {
        await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            templateName: "staff-invite",
            recipientEmail: email,
            idempotencyKey: `athlete-invite:${(inv as any).id}`,
            templateData: {
              organizationName: (org as any)?.name ?? "BODYFUEL",
              roleLabel: "Athlet:in / Spieler:in",
              scopeLabel: (team as any)?.name ? `Team: ${(team as any).name}` : "Verein",
              inviteUrl,
              inviterName: (inviter as any)?.display_name ?? undefined,
            },
          }),
        });
      }
      void claims;
    } catch (e) {
      console.error("[createAthleteInvite] email dispatch error", e);
    }

    return { id: (inv as any).id, invite_token: inviteToken };
  });

/** Manuell einen Kaderplatz ohne Account anlegen (pending). */
export const createPendingRosterAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string | null;
      first_name: string;
      last_name: string;
      date_of_birth?: string | null;
      height_cm?: number | null;
      weight_kg?: number | null;
      primary_position?: string | null;
      secondary_position?: string | null;
      jersey_number?: number | null;
      note?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageRoster({ supabase, userId, organization_id: data.organization_id, team_id: data.team_id });
    if (!data.first_name.trim() || !data.last_name.trim()) {
      throw new Error("Vorname und Nachname sind Pflicht.");
    }
    const { data: row, error } = await supabase
      .from("roster_pending_athletes")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        date_of_birth: data.date_of_birth ?? null,
        height_cm: data.height_cm ?? null,
        weight_kg: data.weight_kg ?? null,
        primary_position: data.primary_position ?? null,
        secondary_position: data.secondary_position ?? null,
        jersey_number: data.jersey_number ?? null,
        note: data.note ?? null,
        created_by: userId,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

/** Liste pending Roster-Einträge einer Organisation. */
export const listPendingRosterAthletes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("roster_pending_athletes")
      .select("id, team_id, first_name, last_name, primary_position, secondary_position, jersey_number, linked_user_id, created_at")
      .eq("organization_id", data.organization_id)
      .is("linked_user_id", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Pending Roster-Eintrag löschen. */
export const deletePendingRosterAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("roster_pending_athletes")
      .select("organization_id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Eintrag nicht gefunden.");
    await assertCanManageRoster({
      supabase,
      userId,
      organization_id: (row as any).organization_id,
      team_id: (row as any).team_id,
    });
    const { error } = await supabase.from("roster_pending_athletes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Athlet aus Team entfernen. Setzt team_memberships.status='inactive' — der
 * BodyFuel-Account des Athleten bleibt bestehen, nur der Team-/Kaderplatz wird
 * deaktiviert. Für vollständige Kontolöschung siehe deleteOrgAthlete.
 */
export const removeAthleteFromTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id: string; team_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageRoster({
      supabase,
      userId,
      organization_id: data.organization_id,
      team_id: data.team_id,
    });
    const { error } = await supabase
      .from("team_memberships")
      .update({ status: "inactive" as any })
      .eq("user_id", data.user_id)
      .eq("team_id", data.team_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

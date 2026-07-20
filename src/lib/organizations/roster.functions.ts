import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
  .validator((d: { organization_id: string; team_id?: string | null }) => d)
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
  .validator(
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
  .validator(
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
  .validator((d: { organization_id: string }) => d)
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
  .validator((d: { id: string }) => d)
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
  .validator((d: { organization_id: string; user_id: string; team_id: string }) => d)
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

/**
 * Existierende BODYFUEL-Nutzer suchen (nach E-Mail oder Anzeigename), um sie
 * einem Verein/Team hinzuzufügen. Nur für Rollen mit Roster-Verwaltungsrecht.
 * Nutzt supabaseAdmin (RLS-Bypass), gibt aber ausschließlich minimale
 * Identifikationsfelder zurück und keine sensiblen Profil-Daten.
 */
export const searchExistingAthletes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organization_id: string; query: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageRoster({ supabase, userId, organization_id: data.organization_id });

    const q = data.query.trim();
    if (q.length < 2) return [] as Array<{
      user_id: string; display_name: string | null; email: string | null;
      already_in_org: boolean;
    }>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isEmail = q.includes("@");

    // 1) Kandidaten-User-IDs sammeln
    const candidateIds = new Set<string>();
    const emailMap = new Map<string, string>(); // user_id -> email

    if (isEmail) {
      const { data: authRows } = await (supabaseAdmin as any)
        .from("users")
        .select("id, email")
        .schema("auth" as any)
        .ilike("email", `%${q}%`)
        .limit(20);
      // schema('auth') via PostgREST wird i. d. R. nicht freigegeben — fallback:
      if (!authRows) {
        try {
          const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const needle = q.toLowerCase();
          for (const u of data.users) {
            if (u.email?.toLowerCase().includes(needle)) {
              candidateIds.add(u.id);
              if (u.email) emailMap.set(u.id, u.email);
              if (candidateIds.size >= 20) break;
            }
          }
        } catch {
          /* ignore */
        }
      } else {
        for (const r of authRows as any[]) {
          candidateIds.add(r.id);
          emailMap.set(r.id, r.email);
        }
      }
    }

    // 2) Profil-Suche nach display_name (immer)
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .limit(20);
    for (const p of (profs ?? []) as any[]) candidateIds.add(p.id);

    if (candidateIds.size === 0) return [];

    const ids = Array.from(candidateIds).slice(0, 30);

    // 3) Bereits in dieser Org?
    const { data: existingMems } = await supabaseAdmin
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .in("user_id", ids);
    const inOrg = new Set((existingMems ?? []).map((m: any) => m.user_id));

    // 4) Anzeigenamen holen (falls oben nur via auth gefunden)
    const { data: allProfs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameMap = new Map<string, string | null>();
    for (const p of (allProfs ?? []) as any[]) nameMap.set(p.id, p.display_name ?? null);

    // 5) E-Mails auffüllen (falls Suche über Namen kam)
    const missingEmailIds = ids.filter((id) => !emailMap.has(id));
    if (missingEmailIds.length > 0) {
      try {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        for (const u of data.users) {
          if (missingEmailIds.includes(u.id) && u.email) emailMap.set(u.id, u.email);
        }
      } catch {
        /* ignore */
      }
    }

    return ids.map((id) => ({
      user_id: id,
      display_name: nameMap.get(id) ?? null,
      email: emailMap.get(id) ?? null,
      already_in_org: inOrg.has(id),
    }));
  });

/** Bestehenden Nutzer direkt einem Team der Organisation hinzufügen. */
export const addExistingUserToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organization_id: string;
      team_id: string;
      user_id: string;
      primary_position?: string | null;
      secondary_position?: string | null;
      jersey_number?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageRoster({
      supabase,
      userId,
      organization_id: data.organization_id,
      team_id: data.team_id,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: memErr } = await supabaseAdmin.from("organization_memberships").upsert(
      {
        user_id: data.user_id,
        organization_id: data.organization_id,
        role: "athlete" as any,
        status: "active" as any,
      } as any,
      { onConflict: "user_id,organization_id" },
    );
    if (memErr) throw new Error(memErr.message);

    const tmPayload: Record<string, unknown> = {
      user_id: data.user_id,
      team_id: data.team_id,
      status: "active",
    };
    if (data.primary_position) tmPayload.position = data.primary_position;
    if (data.secondary_position) tmPayload.secondary_position = data.secondary_position;
    if (data.jersey_number != null) tmPayload.jersey_number = data.jersey_number;

    const { error: tmErr } = await supabaseAdmin
      .from("team_memberships")
      .upsert(tmPayload as any, { onConflict: "user_id,team_id" });
    if (tmErr) throw new Error(tmErr.message);

    return { ok: true };
  });


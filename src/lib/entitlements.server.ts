/**
 * Serverseitige Auflösung des BodyFuel-Entitlements.
 *
 * WICHTIG: Diese Datei ist server-only (`*.server.ts`) und darf niemals
 * direkt aus Komponenten importiert werden.
 */
import {
  type Entitlement,
  FREE_ENTITLEMENT,
  resolveEntitlement,
  smartGateMessage,
  todayIso,
} from "@/lib/entitlements.logic";

/**
 * Liest Profil + Pakete, stößt die serverseitige Ablaufbereinigung an und
 * liefert das aufgelöste Entitlement. Der Ablauf wird zusätzlich live
 * berechnet, damit ein verzögerter Cron-Lauf niemals Zugriff verlängert.
 */
export async function resolveEntitlementFor(userId: string): Promise<Entitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Self-Healing: abgelaufene Trials dauerhaft auf trial_expired setzen und
  // die Trial-Paketzeile deaktivieren. Best-effort — die Live-Berechnung
  // unten ist ohnehin maßgeblich.
  try {
    await supabaseAdmin.rpc("expire_stale_trials", { _user_id: userId });
  } catch (error) {
    console.error("[entitlements] expire_stale_trials failed", error);
  }

  const [{ data: profile }, { data: packages }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("trial_status, trial_end")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("customer_packages")
      .select("package, is_active, source, end_date")
      .eq("user_id", userId),
  ]);

  if (!profile && !packages?.length) return FREE_ENTITLEMENT;

  return resolveEntitlement({
    trialStatus: (profile as { trial_status?: string } | null)?.trial_status ?? null,
    trialEnd: (profile as { trial_end?: string } | null)?.trial_end ?? null,
    packages: (packages ?? []) as never,
    today: todayIso(),
  });
}

export class SmartAccessError extends Error {
  readonly code = "SMART_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "SmartAccessError";
  }
}

/**
 * Serverseitiger Gate für alle Smart-Funktionen (KI-Ernährungsplan,
 * KI-Trainingsplan, Einkaufsliste, Strength Check, Prognosen, Partner-Modus,
 * Smart-Onboarding). Wirft, wenn kein gültiges Smart-Entitlement besteht.
 */
export async function assertSmartAccess(userId: string): Promise<Entitlement> {
  const entitlement = await resolveEntitlementFor(userId);
  if (!entitlement.hasSmart) {
    // Coaches und Plattform-Owner haben immer Vollzugriff (arbeiten für Kunden).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const privileged = (roles ?? []).some(
      (r: { role: string }) => r.role === "coach" || r.role === "platform_owner",
    );
    if (privileged) return { ...entitlement, hasSmart: true };
  }
  if (!entitlement.hasSmart) {
    throw new SmartAccessError(smartGateMessage(entitlement));
  }
  return entitlement;
}

/**
 * Hält die sichtbare Trial-Paketzeile (`customer_packages`, source='trial')
 * mit dem Profil-Trial synchron. Diese Zeile ist NUR Anzeige/Vereinheitlichung
 * und wird bei bezahlten Checks per `source <> 'trial'` ausgeschlossen —
 * ein Trial kann dadurch niemals in ein bezahltes Abo „hineinwachsen".
 */
export async function activateTrialPackage(userId: string, start: string, end: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("customer_packages").upsert(
    {
      user_id: userId,
      package: "smart",
      price_eur: 0,
      start_date: start,
      end_date: end,
      is_active: true,
      source: "trial",
      status: "trial",
      started_at: new Date().toISOString(),
      ended_at: null,
      notes: "7-Tage-Smart-Test",
    } as never,
    { onConflict: "user_id,package" },
  );
  if (error) console.error("[entitlements] activateTrialPackage failed", error);
}

/** Beendet die Trial-Paketzeile sofort (Coach beendet Test / Ablauf). */
export async function deactivateTrialPackage(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("customer_packages")
    .update({ is_active: false, status: "expired", ended_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .eq("source", "trial");
  if (error) console.error("[entitlements] deactivateTrialPackage failed", error);
}

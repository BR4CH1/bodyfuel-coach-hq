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
    throw new SmartAccessError(smartGateMessage(entitlement));
  }
  return entitlement;
}

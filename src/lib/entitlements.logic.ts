/**
 * BodyFuel Entitlement-Resolver (pure, testbar).
 *
 * Vereinheitlicht die beiden bisher getrennten Systeme:
 *  - `profiles.trial_status` / `trial_end`  → 7-Tage-Smart-Test
 *  - `customer_packages`                    → gekaufte/manuell vergebene Pakete
 *
 * Ergebnis ist genau EIN Tier: "free" | "smart" | "coaching".
 * Ein laufender Trial zählt als vollwertiges Smart-Entitlement, ist aber
 * über `isTrial` erkennbar und läuft am `expiresOn`-Datum ersatzlos aus.
 *
 * Diese Logik spiegelt 1:1 die DB-Funktion `public.resolve_entitlement`.
 */

export const TRIAL_DAYS = 7;

export type EntitlementTier = "free" | "smart" | "coaching";

export type PackageRow = {
  package: string | null;
  is_active: boolean | null;
  source: string | null;
  end_date: string | null;
};

export type EntitlementInput = {
  trialStatus: string | null | undefined;
  trialEnd: string | null | undefined;
  packages: ReadonlyArray<PackageRow> | null | undefined;
  /** ISO-Datum (yyyy-mm-dd) des „heute" — für Tests injizierbar. */
  today: string;
};

export type Entitlement = {
  tier: EntitlementTier;
  /** true, wenn der Smart-Zugriff aus dem kostenlosen 7-Tage-Test stammt. */
  isTrial: boolean;
  trialStatus: "none" | "trial" | "trial_expired" | "active";
  /** Verbleibende Tage im Trial (0 = letzter Tag), sonst null. */
  trialDaysLeft: number | null;
  /** Ablaufdatum des aktuellen Entitlements (yyyy-mm-dd) oder null. */
  expiresOn: string | null;
  /** Test wurde genutzt und ist beendet — Upgrade-Aufforderung zeigen. */
  isTrialExpired: boolean;
  /** Smart-Funktionen freigeschaltet (Smart ODER Coaching). */
  hasSmart: boolean;
  hasCoaching: boolean;
  /** Der Paketschlüssel des bezahlten Pakets, falls vorhanden. */
  paidPackage: string | null;
};

const PAID_RANK: Record<string, number> = {
  coaching: 1,
  premium: 1,
  starter: 1,
  smart: 2,
};

export function todayIso(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Ganze Tage zwischen zwei ISO-Datumsangaben (b - a). */
export function daysBetweenIso(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

function normalizeTrialStatus(value: string | null | undefined): Entitlement["trialStatus"] {
  if (value === "trial" || value === "trial_expired" || value === "active") return value;
  return "none";
}

export function resolveEntitlement(input: EntitlementInput): Entitlement {
  const today = input.today;
  const trialStatusRaw = normalizeTrialStatus(input.trialStatus);
  const trialEnd = input.trialEnd ?? null;

  // Trial-Ablauf wird IMMER live berechnet — unabhängig davon, ob der
  // Cron-Job den DB-Status schon nachgezogen hat.
  const trialRunning = trialStatusRaw === "trial" && !!trialEnd && trialEnd >= today;
  const trialStatus: Entitlement["trialStatus"] =
    trialStatusRaw === "trial" && !trialRunning ? "trial_expired" : trialStatusRaw;

  const paid = (input.packages ?? [])
    .filter(
      (p) =>
        p.is_active === true &&
        p.source !== "trial" &&
        !!p.package &&
        (p.end_date === null || p.end_date >= today),
    )
    .sort((a, b) => {
      const ra = PAID_RANK[a.package as string] ?? 3;
      const rb = PAID_RANK[b.package as string] ?? 3;
      if (ra !== rb) return ra - rb;
      return (b.end_date ?? "9999-12-31").localeCompare(a.end_date ?? "9999-12-31");
    })[0];

  let tier: EntitlementTier = "free";
  let isTrial = false;
  let expiresOn: string | null = null;
  let trialDaysLeft: number | null = null;

  if (paid) {
    tier = paid.package === "smart" ? "smart" : "coaching";
    expiresOn = paid.end_date;
  } else if (trialRunning) {
    tier = "smart";
    isTrial = true;
    expiresOn = trialEnd;
    trialDaysLeft = Math.max(0, daysBetweenIso(today, trialEnd as string));
  } else if (trialStatus === "active") {
    // Legacy: vom Coach freigeschaltete Mitgliedschaft ohne Paketzeile.
    tier = "coaching";
  }

  return {
    tier,
    isTrial,
    trialStatus,
    trialDaysLeft,
    expiresOn,
    isTrialExpired: trialStatus === "trial_expired" && tier === "free",
    hasSmart: tier === "smart" || tier === "coaching",
    hasCoaching: tier === "coaching",
    paidPackage: paid?.package ?? null,
  };
}

export const FREE_ENTITLEMENT: Entitlement = {
  tier: "free",
  isTrial: false,
  trialStatus: "none",
  trialDaysLeft: null,
  expiresOn: null,
  isTrialExpired: false,
  hasSmart: false,
  hasCoaching: false,
  paidPackage: null,
};

export const TRIAL_EXPIRED_MESSAGE =
  "Dein 7-Tage-Smart-Test ist beendet. Buche Smart, um alle Funktionen weiter zu nutzen.";

export const SMART_REQUIRED_MESSAGE =
  "Diese Funktion gehört zu BodyFuel Smart. Buche Smart, um sie zu nutzen.";

export function smartGateMessage(entitlement: Entitlement): string {
  return entitlement.isTrialExpired ? TRIAL_EXPIRED_MESSAGE : SMART_REQUIRED_MESSAGE;
}

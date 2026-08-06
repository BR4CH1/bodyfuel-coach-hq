import { describe, expect, it } from "vitest";
import {
  resolveEntitlement,
  TRIAL_DAYS,
  daysBetweenIso,
  type PackageRow,
} from "@/lib/entitlements.logic";

const TODAY = "2026-03-10";

function trialEndAfter(days: number, from = TODAY): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const paidSmart: PackageRow = {
  package: "smart",
  is_active: true,
  source: "stripe",
  end_date: null,
};

describe("Entitlement-Resolver", () => {
  it("Trial startet mit exakt 7 Tagen Laufzeit", () => {
    const end = trialEndAfter(TRIAL_DAYS);
    expect(daysBetweenIso(TODAY, end)).toBe(7);
  });

  it("Trial-Nutzer wird als Smart erkannt", () => {
    const e = resolveEntitlement({
      trialStatus: "trial",
      trialEnd: trialEndAfter(TRIAL_DAYS),
      packages: [],
      today: TODAY,
    });
    expect(e.tier).toBe("smart");
    expect(e.hasSmart).toBe(true);
    expect(e.isTrial).toBe(true);
    expect(e.trialDaysLeft).toBe(7);
    expect(e.isTrialExpired).toBe(false);
  });

  it("letzter Trial-Tag zählt noch als Smart", () => {
    const e = resolveEntitlement({
      trialStatus: "trial",
      trialEnd: TODAY,
      packages: [],
      today: TODAY,
    });
    expect(e.hasSmart).toBe(true);
    expect(e.trialDaysLeft).toBe(0);
  });

  it('status="none" bleibt Free', () => {
    const e = resolveEntitlement({
      trialStatus: "none",
      trialEnd: null,
      packages: [],
      today: TODAY,
    });
    expect(e.tier).toBe("free");
    expect(e.hasSmart).toBe(false);
    expect(e.isTrialExpired).toBe(false);
  });

  it("abgelaufener Trial führt zu trial_expired + Free — auch ohne Cron-Lauf", () => {
    const e = resolveEntitlement({
      // DB-Status noch 'trial' (Cron verzögert), Enddatum aber in der Vergangenheit
      trialStatus: "trial",
      trialEnd: "2026-03-09",
      packages: [],
      today: TODAY,
    });
    expect(e.trialStatus).toBe("trial_expired");
    expect(e.tier).toBe("free");
    expect(e.hasSmart).toBe(false);
    expect(e.isTrialExpired).toBe(true);
  });

  it("abgelaufene Trial-Paketzeile verlängert den Zugriff nicht", () => {
    const e = resolveEntitlement({
      trialStatus: "trial_expired",
      trialEnd: "2026-03-01",
      packages: [
        { package: "smart", is_active: true, source: "trial", end_date: "2029-01-01" },
      ],
      today: TODAY,
    });
    expect(e.hasSmart).toBe(false);
    expect(e.paidPackage).toBeNull();
  });

  it("Checkout aktiviert dauerhaft Smart", () => {
    const e = resolveEntitlement({
      trialStatus: "trial_expired",
      trialEnd: "2026-03-01",
      packages: [paidSmart],
      today: TODAY,
    });
    expect(e.tier).toBe("smart");
    expect(e.hasSmart).toBe(true);
    expect(e.isTrial).toBe(false);
    expect(e.isTrialExpired).toBe(false);
    expect(e.paidPackage).toBe("smart");
  });

  it("bezahltes Paket schlägt laufenden Trial", () => {
    const e = resolveEntitlement({
      trialStatus: "trial",
      trialEnd: trialEndAfter(3),
      packages: [paidSmart],
      today: TODAY,
    });
    expect(e.isTrial).toBe(false);
    expect(e.tier).toBe("smart");
  });

  it("Coaching-Kunden bleiben unbeeinträchtigt", () => {
    const e = resolveEntitlement({
      trialStatus: "none",
      trialEnd: null,
      packages: [
        { package: "coaching", is_active: true, source: "manual", end_date: "2030-01-01" },
      ],
      today: TODAY,
    });
    expect(e.tier).toBe("coaching");
    expect(e.hasCoaching).toBe(true);
    expect(e.hasSmart).toBe(true);
  });

  it("inaktive oder abgelaufene Pakete zählen nicht", () => {
    const e = resolveEntitlement({
      trialStatus: "none",
      trialEnd: null,
      packages: [
        { package: "smart", is_active: false, source: "stripe", end_date: null },
        { package: "coaching", is_active: true, source: "manual", end_date: "2026-03-09" },
      ],
      today: TODAY,
    });
    expect(e.tier).toBe("free");
  });

  it("Legacy-Mitgliedschaft (trial_status=active) bleibt Coaching", () => {
    const e = resolveEntitlement({
      trialStatus: "active",
      trialEnd: null,
      packages: [],
      today: TODAY,
    });
    expect(e.tier).toBe("coaching");
    expect(e.hasSmart).toBe(true);
  });

  it("direkter /auth-Signup (kein Trial gestartet) erhält kein Smart", () => {
    const e = resolveEntitlement({
      trialStatus: null,
      trialEnd: null,
      packages: [],
      today: TODAY,
    });
    expect(e.trialStatus).toBe("none");
    expect(e.hasSmart).toBe(false);
  });
});

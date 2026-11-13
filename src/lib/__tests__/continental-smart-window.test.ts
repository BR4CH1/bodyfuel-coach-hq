import { describe, expect, it } from "vitest";
import { continentalPackageWindow } from "@/lib/continental-challenge.functions";

describe("Continentale Challenge Smart-Zugang", () => {
  it("läuft 30 Tage ab Challenge-Start (15.11.) bis 15.12.", () => {
    expect(continentalPackageWindow("2026-11-13").end_date).toBe("2026-12-15");
  });
  it("gibt Zugang sofort ab Freigabe für das Onboarding", () => {
    expect(continentalPackageWindow("2026-11-13").start_date).toBe("2026-11-13");
  });
});

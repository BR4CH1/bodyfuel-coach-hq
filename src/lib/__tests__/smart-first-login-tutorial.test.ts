import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Smart first-login tutorial", () => {
  it("routes the existing Smart onboarding gate through the tutorial first", () => {
    const layout = source("src/components/bodyfuel/AppLayout.tsx");
    expect(layout).toContain('navigate({ to: "/onboarding/smart-start" });');
    expect(layout).toContain('pathname.startsWith("/onboarding/smart")');
  });

  it("explains Smart Nutrition and delegates plan creation to the existing onboarding", () => {
    const tutorial = source("src/routes/onboarding.smart-start.tsx");
    expect(tutorial).toContain("Smart Nutrition");
    expect(tutorial).toContain("Autopilot starten");
    expect(tutorial).toContain('navigate({ to: "/onboarding/smart" })');
    expect(tutorial).not.toContain("completeSmartOnboarding");
  });

  it("keeps a replay entry point in the Smart profile", () => {
    const profile = source("src/routes/profile.tsx");
    expect(profile).toContain("Smart Tutorial");
    expect(profile).toContain('navigate({ to: "/onboarding/smart-start" })');
  });
});

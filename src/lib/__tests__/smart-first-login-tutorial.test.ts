import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Smart guided first-plan flow", () => {
  it("routes incomplete Smart users into the guided start flow", () => {
    const layout = source("src/components/bodyfuel/AppLayout.tsx");
    expect(layout).toContain('navigate({ to: "/onboarding/smart-start" });');
    expect(layout).toContain('pathname.startsWith("/onboarding/smart")');
  });

  it("uses the real onboarding action instead of an explanatory pre-tutorial", () => {
    const start = source("src/routes/onboarding.smart-start.tsx");
    expect(start).toContain("completeSmartOnboarding");
    expect(start).toContain("Ernährungsplan erstellen");
    expect(start).not.toContain('navigate({ to: "/onboarding/smart" })');
  });

  it("waits for the real nutrition plan and then sends the user into it", () => {
    const start = source("src/routes/onboarding.smart-start.tsx");
    expect(start).toContain("getMyAutopilotJob");
    expect(start).toContain("nutrition_plan_id");
    expect(start).toContain('navigate({ to: "/nutrition" })');
    expect(start).toContain("Dein Ernährungsplan ist fertig");
  });

  it("keeps training generation independent from the nutrition handoff", () => {
    const start = source("src/routes/onboarding.smart-start.tsx");
    expect(start).toContain("training_plan_id");
    expect(start).toContain("im Hintergrund weiter");
  });

  it("keeps the Smart profile entry point", () => {
    const profile = source("src/routes/profile.tsx");
    expect(profile).toContain("Smart Tutorial");
    expect(profile).toContain('navigate({ to: "/onboarding/smart-start" })');
  });
});

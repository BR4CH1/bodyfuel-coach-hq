import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("coach customer subpoint information architecture", () => {
  const route = read("src/routes/coach.customers.$userId.tsx");

  it("uses one primary nutrition plan-management surface", () => {
    expect(route).toContain("<PlanManagementCard userId={userId} />");
    expect(route).not.toContain("<CoachNutritionPlanHistoryCard");
    expect(route).not.toContain("Plan manuell erstellen");
  });

  it("orders the progress tab as a check-in workflow", () => {
    const checkins = route.indexOf("<CustomerCheckinsCard userId={userId} />");
    const draft = route.indexOf("<AiCheckinDraftCard userId={userId} />");
    const adjustments = route.indexOf("<PlanAdjustmentsCard userId={userId} />");
    const weight = route.indexOf("<WeightProgressChart");
    expect(checkins).toBeGreaterThan(0);
    expect(checkins).toBeLessThan(draft);
    expect(draft).toBeLessThan(adjustments);
    expect(adjustments).toBeLessThan(weight);
  });

  it("keeps nutrition macros out of the training-goal card", () => {
    const trainingGoal = read("src/components/bodyfuel/CoachTrainingGoalCard.tsx");
    expect(trainingGoal).not.toContain("protein_g");
    expect(trainingGoal).not.toContain("carbs_g");
    expect(trainingGoal).not.toContain("fat_g");
  });

  it("has only one visible auto-publish owner", () => {
    const smart = read("src/components/bodyfuel/SmartNutritionInsightsCard.tsx");
    expect(smart).not.toContain("setCustomerAutoPublish");
    expect(smart).not.toContain("Auto-Publish:");
  });
});

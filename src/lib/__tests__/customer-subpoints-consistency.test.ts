import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(rel: string) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

describe("coach customer subpoint data consistency", () => {
  it("uses the shared effective nutrition target resolver in coach insight pipelines", () => {
    const smart = read("src/lib/coach-smart-insights.functions.ts");
    const checkin = read("src/lib/checkin-ai.functions.ts");
    const adjustments = read("src/lib/plan-adjustments.functions.ts");

    expect(smart).toContain("loadEffectiveNutritionTargets");
    expect(checkin).toContain("loadEffectiveNutritionTargets");
    expect(adjustments).toContain("loadEffectiveNutritionTargets");
  });

  it("does not use the Bulls-only weight stream for normal coach check-ins or adjustments", () => {
    expect(read("src/lib/checkin-ai.functions.ts")).not.toContain('.from("bulls_weight_logs")');
    expect(read("src/lib/plan-adjustments.functions.ts")).not.toContain('.from("bulls_weight_logs")');
  });

  it("applies training adjustments to the current unified training-plan table", () => {
    const adjustments = read("src/lib/plan-adjustments.functions.ts");
    expect(adjustments).not.toContain('.from("training_plans")');
    expect(adjustments).toContain('.eq("plan_type", "training")');
    expect(adjustments).toContain('.eq("status", "active")');
  });
});

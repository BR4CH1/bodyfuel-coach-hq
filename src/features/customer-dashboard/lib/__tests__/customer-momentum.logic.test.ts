import { describe, expect, it } from "vitest";
import { buildCustomerMomentum } from "../customer-momentum.logic";
import type { CustomerBriefingViewModel } from "../../types";

function briefing(progress: CustomerBriefingViewModel["progress"]): CustomerBriefingViewModel {
  return { state: "clear", emotion: "happy", title: "", summary: "", items: [], progress };
}

describe("customer momentum logic", () => {
  it("marks a complete day", () => {
    const result = buildCustomerMomentum(
      briefing({ trainedToday: true, measuredToday: true, todayPoints: 30, maxDailyPoints: 30 }),
    );
    expect(result.state).toBe("complete");
    expect(result.completion).toBe(100);
  });

  it("keeps progress bounded when points exceed the maximum", () => {
    const result = buildCustomerMomentum(
      briefing({ trainedToday: false, measuredToday: false, todayPoints: 99, maxDailyPoints: 30 }),
    );
    expect(result.completion).toBe(33);
  });

  it("shows a start state without completed signals", () => {
    const result = buildCustomerMomentum(
      briefing({ trainedToday: false, measuredToday: false, todayPoints: 0, maxDailyPoints: 30 }),
    );
    expect(result.state).toBe("start");
  });
});

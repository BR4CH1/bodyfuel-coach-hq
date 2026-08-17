import { describe, expect, it } from "vitest";

import {
  buildCoachActivityFeed,
  formatActivityTime,
} from "@/features/coach-dashboard/lib/coach-recent-activity.logic";
import type { CoachClient } from "@/features/coach-dashboard/types";

function client(partial: Partial<CoachClient> & { id: string }): CoachClient {
  return {
    display_name: null,
    last_checkin: null,
    last_checkin_submitted_at: null,
    pending_checkin_week_start: null,
    pending_checkin_submitted_at: null,
    last_weight: null,
    last_weight_at: null,
    last_nutrition_at: null,
    last_nutrition_name: null,
    last_training_at: null,
    nutrition_plan_end: null,
    training_plan_end: null,
    kcal_dev: null,
    kcal_dev_dir: null,
    plateau_days: null,
    ...partial,
  };
}

describe("buildCoachActivityFeed", () => {
  it("sorts across clients newest first and formats details", () => {
    const feed = buildCoachActivityFeed([
      client({
        id: "a",
        display_name: "Anna",
        last_nutrition_at: "2026-08-17T10:00:00Z",
        last_nutrition_name: "Skyr",
        last_weight_at: "2026-08-15T08:00:00Z",
        last_weight: 82.4,
      }),
      client({
        id: "b",
        display_name: "Ben",
        last_training_at: "2026-08-17T12:00:00Z",
        last_checkin_submitted_at: "2026-08-16T09:00:00Z",
      }),
    ]);

    expect(feed.map((e) => e.id)).toEqual([
      "b-training",
      "a-nutrition",
      "b-checkin",
      "a-weight",
    ]);
    expect(feed[1].detail).toBe("Skyr");
    expect(feed[3].detail).toBe("Gewicht 82.4 kg");
    expect(feed[2].detail).toBe("Check-in eingereicht");
  });

  it("skips missing/invalid timestamps and respects the limit", () => {
    const feed = buildCoachActivityFeed(
      [
        client({ id: "a", last_nutrition_at: "not-a-date" }),
        client({ id: "b", last_training_at: "2026-08-17T12:00:00Z" }),
        client({ id: "c", last_training_at: "2026-08-16T12:00:00Z" }),
      ],
      1,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0].userId).toBe("b");
  });
});

describe("formatActivityTime", () => {
  const now = new Date("2026-08-17T15:00:00Z");
  it("labels today and yesterday", () => {
    expect(formatActivityTime("2026-08-17T09:00:00Z", now)).toMatch(/^Heute · /);
    expect(formatActivityTime("2026-08-16T09:00:00Z", now)).toMatch(/^Gestern · /);
  });
  it("falls back to a German date", () => {
    expect(formatActivityTime("2026-08-10T09:00:00Z", now)).toMatch(/^10\.08\.26 · /);
  });
  it("handles invalid input", () => {
    expect(formatActivityTime("nope", now)).toBe("—");
  });
});

import { describe, expect, it } from "vitest";

import { countActiveProductCustomers } from "../coach-dashboard.data";

describe("countActiveProductCustomers", () => {
  it("deduplicates customers and separates Coaching from paid Smart", () => {
    const result = countActiveProductCustomers(
      [
        {
          user_id: "coach-1",
          package: "coaching",
          source: "manual",
          end_date: "2026-09-01",
          status: "active",
        },
        {
          user_id: "coach-1",
          package: "starter",
          source: "manual",
          end_date: "2026-09-01",
          status: "active",
        },
        {
          user_id: "coach-2",
          package: "premium",
          source: "manual",
          end_date: "2026-09-01",
          status: "active",
        },
        {
          user_id: "smart-1",
          package: "smart",
          source: "stripe",
          end_date: "2026-09-01",
          status: "active",
        },
        {
          user_id: "smart-2",
          package: "smart",
          source: "manual",
          end_date: "2026-08-12",
          status: "active",
        },
      ],
      "2026-08-12",
    );

    expect(result.productCounts).toEqual({ coaching: 2, smart: 2 });
    expect(result.coachingIds).toEqual(["coach-1", "coach-2"]);
  });

  it("excludes trials, expired packages and canceled subscriptions", () => {
    const result = countActiveProductCustomers(
      [
        {
          user_id: "trial",
          package: "smart",
          source: "trial",
          end_date: "2026-09-01",
          status: "trial",
        },
        {
          user_id: "expired",
          package: "smart",
          source: "stripe",
          end_date: "2026-08-11",
          status: "active",
        },
        {
          user_id: "canceled",
          package: "smart",
          source: "stripe",
          end_date: "2026-09-01",
          status: "cancelled",
        },
        {
          user_id: "old-coaching",
          package: "coaching",
          source: "manual",
          end_date: "2026-08-11",
          status: "active",
        },
      ],
      "2026-08-12",
    );

    expect(result.productCounts).toEqual({ coaching: 0, smart: 0 });
  });
});

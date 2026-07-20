import { describe, expect, it } from "vitest";
import { buildScheduleRows, createScheduleKey, serializeScheduleRows } from "../schedule.logic";

describe("coach organization schedule logic", () => {
  it("builds one editable row for every weekday", () => {
    const rows = buildScheduleRows([
      {
        id: "monday",
        weekday: 1,
        title: "Team Practice",
        start_time: "18:30:00",
        end_time: "20:00:00",
        active: true,
      },
    ]);

    expect(rows).toHaveLength(7);
    expect(rows[1]).toEqual({
      weekday: 1,
      title: "Team Practice",
      start_time: "18:30",
      end_time: "20:00",
      active: true,
    });
    expect(rows[2].active).toBe(false);
  });

  it("keeps inactive rows that already exist so they can be disabled remotely", () => {
    const result = serializeScheduleRows(
      [
        {
          weekday: 1,
          title: "Team Practice",
          start_time: "",
          end_time: "",
          active: false,
        },
        {
          weekday: 2,
          title: "New Practice",
          start_time: "19:00",
          end_time: "20:30",
          active: true,
        },
      ],
      [{ id: "existing", weekday: 1, active: true }],
    );

    expect(result).toEqual([
      {
        weekday: 1,
        title: "Team Practice",
        start_time: null,
        end_time: null,
        active: false,
      },
      {
        weekday: 2,
        title: "New Practice",
        start_time: "19:00",
        end_time: "20:30",
        active: true,
      },
    ]);
  });

  it("creates a stable key that changes when schedule content changes", () => {
    const first = createScheduleKey("team-1", [
      { id: "row-1", weekday: 1, title: "Practice", active: true },
    ]);
    const second = createScheduleKey("team-1", [
      { id: "row-1", weekday: 1, title: "Film", active: true },
    ]);

    expect(first).not.toBe(second);
  });
});

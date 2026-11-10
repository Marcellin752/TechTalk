import { describe, it, expect } from "vitest";
import { dayKey, fromInputs, groupByDay, monthGrid, sameDay, toDateInput, toTimeInput } from "./calendar";
import type { CalendarEvent } from "../services/api";

describe("monthGrid", () => {
  it("always shows 42 days, Monday first, covering the whole month", () => {
    const grid = monthGrid(2030, 0); // January 2030 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0]!.getDay()).toBe(1);
    expect(dayKey(grid[0]!)).toBe("2029-12-31");
    expect(grid.filter((d) => d.getMonth() === 0)).toHaveLength(31);
  });

  it("handles a month that starts on Monday and on Sunday", () => {
    expect(dayKey(monthGrid(2029, 9)[0]!)).toBe("2029-10-01"); // 1 Oct 2029 is a Monday
    expect(dayKey(monthGrid(2030, 11)[0]!)).toBe("2030-11-25"); // 1 Dec 2030 is a Sunday
  });
});

describe("inputs", () => {
  it("round-trips local date and time", () => {
    const d = fromInputs("2030-01-08", "18:30")!;
    expect(toDateInput(d)).toBe("2030-01-08");
    expect(toTimeInput(d)).toBe("18:30");
  });
  it("rejects incomplete or invalid input", () => {
    expect(fromInputs("", "18:30")).toBeNull();
    expect(fromInputs("2030-01-08", "")).toBeNull();
    expect(fromInputs("2030-13-45", "18:30")).toBeNull();
  });
  it("compares days", () => {
    expect(sameDay(new Date(2030, 0, 8, 1), new Date(2030, 0, 8, 23))).toBe(true);
    expect(sameDay(new Date(2030, 0, 8), new Date(2030, 0, 9))).toBe(false);
  });
});

describe("groupByDay", () => {
  const ev = (id: string, startsAt: Date): CalendarEvent => ({
    id, title: id, kind: "study", startsAt: startsAt.toISOString(), endsAt: startsAt.toISOString(), notes: null, done: false, stepId: null, contentId: null, contentUrl: null, contentType: null,
  });
  it("groups by local day and orders by time", () => {
    const g = groupByDay([ev("late", new Date(2030, 0, 8, 20)), ev("early", new Date(2030, 0, 8, 8)), ev("next", new Date(2030, 0, 9, 8))]);
    expect(g.get("2030-01-08")!.map((e) => e.id)).toEqual(["early", "late"]);
    expect(g.get("2030-01-09")!.map((e) => e.id)).toEqual(["next"]);
  });
});

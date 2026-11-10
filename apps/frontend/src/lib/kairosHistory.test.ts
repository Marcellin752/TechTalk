import { describe, expect, it } from "vitest";
import { groupHistory, groupOf } from "./kairosHistory";
import type { KairosConversation } from "../services/api";

const now = new Date(2030, 0, 15, 10, 0);
const at = (daysAgo: number, hour = 9) => new Date(2030, 0, 15 - daysAgo, hour, 0).toISOString();
const c = (id: string, title: string, daysAgo: number): KairosConversation => ({ id, title, updatedAt: at(daysAgo) });

describe("kairos history", () => {
  it("places a conversation by the day it was last used", () => {
    expect(groupOf(at(0, 1), now)).toBe("today");
    expect(groupOf(at(1, 23), now)).toBe("yesterday");
    expect(groupOf(at(3), now)).toBe("week");
    expect(groupOf(at(6), now)).toBe("week");
    expect(groupOf(at(7), now)).toBe("older");
    expect(groupOf(at(90), now)).toBe("older");
  });
  it("groups newest first and drops empty groups", () => {
    const g = groupHistory([c("a", "Old", 30), c("b", "New", 0), c("c", "Newer", 0), c("d", "Mid", 3)], "", now);
    expect(g.map((x) => x.group)).toEqual(["today", "week", "older"]);
    expect(g[0]!.items.map((i) => i.id).sort()).toEqual(["b", "c"]);
  });
  it("filters by the search text, ignoring case", () => {
    const g = groupHistory([c("a", "Pointers in C", 0), c("b", "Calendar help", 0)], "  POINTERS ", now);
    expect(g).toHaveLength(1);
    expect(g[0]!.items[0]!.id).toBe("a");
    expect(groupHistory([c("a", "x", 0)], "nothing", now)).toEqual([]);
  });
});

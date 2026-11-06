import { describe, it, expect } from "vitest";
import { buildSections, WILDCARD_MIN, WILDCARD_SPAN } from "./feedLayout";
import type { ContentItem } from "../types/content";

let n = 0;
const make = (type: ContentItem["type"], over: Partial<ContentItem> = {}): ContentItem => ({ id: `i${++n}`, type, ...over }) as ContentItem;

describe("buildSections", () => {
  const videos = Array.from({ length: 80 }, () => make("video"));

  it("keeps bands full and alternates formats", () => {
    const s = buildSections([...videos, ...Array.from({ length: 12 }, () => make("repo")), ...Array.from({ length: 9 }, () => make("article"))]);
    expect(s[0]!.kind).toBe("videos");
    expect(s.find((x) => x.kind === "repos")!.items).toHaveLength(3);
  });

  it("places a wildcard video inside a band, roughly every 20 to 30 items, and never as an extra card", () => {
    const wild = Array.from({ length: 3 }, () => make("video", { wildcard: true }));
    const sections = buildSections([...videos, ...wild]);
    const bands = sections.filter((x) => x.kind === "videos");
    expect(bands.every((b) => b.items.length === 4)).toBe(true); // the band keeps its size
    let shown = 0;
    const gaps: number[] = [];
    let last = 0;
    for (const sec of sections) {
      if (sec.kind === "opportunity") continue;
      shown += sec.items.length;
      if (sec.items.some((i) => i.wildcard)) {
        gaps.push(shown - last);
        last = shown;
      }
    }
    expect(gaps.length).toBeGreaterThanOrEqual(2);
    // the band that carries it closes the window, so a gap is at most a band beyond the threshold
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(WILDCARD_MIN);
      expect(g).toBeLessThanOrEqual(WILDCARD_MIN + WILDCARD_SPAN + 4);
    }
  });

  it("does not show a wildcard twice or invent one when there is none", () => {
    const shown = buildSections(videos).flatMap((x) => x.items);
    expect(shown.some((i) => i.wildcard)).toBe(false);
    const wild = make("video", { wildcard: true });
    const ids = buildSections([...videos, wild, { ...wild }]).flatMap((x) => x.items).filter((i) => i.id === wild.id);
    expect(ids.length).toBeLessThanOrEqual(1);
  });

  it("ignores a wildcard of a format that has no band to host it", () => {
    const opp = make("opportunity", { wildcard: true });
    expect(buildSections([...videos, opp]).flatMap((x) => x.items).some((i) => i.id === opp.id)).toBe(false);
  });
});

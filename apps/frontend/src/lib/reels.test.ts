import { describe, expect, it } from "vitest";
import { isShort, kindOf, KIND_TYPES, ReelsQueue, RHYTHM, youtubeId, type ReelKind } from "./reels";
import type { ContentItem } from "../types/content";

const item = (id: string, type: ContentItem["type"], over: Partial<ContentItem> = {}): ContentItem => ({
  id, type, source: "YouTube", title: `Item ${id}`, url: type === "video" ? `https://www.youtube.com/watch?v=${id.padEnd(11, "x")}` : `https://example.org/${id}`,
  summary: "", image: "", author: "a", category: "c", body: "", date: "", ...over,
});

/** A fake API: `size` items of each kind, handed out a page at a time. */
function fakeApi(size: Record<ReelKind, number>, make: (kind: ReelKind, i: number) => ContentItem) {
  const calls: Array<[ReelKind, number]> = [];
  const fetchPage = async (kind: ReelKind, offset: number, limit: number) => {
    calls.push([kind, offset]);
    return Array.from({ length: Math.max(0, Math.min(limit, size[kind] - offset)) }, (_, i) => make(kind, offset + i));
  };
  return { fetchPage, calls };
}

const make = (kind: ReelKind, i: number) => item(`${kind}-${i}`, kind === "learn" ? "course" : kind);

describe("helpers", () => {
  it("reads YouTube ids from the usual addresses", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=NQGZ9fwFMnU")).toBe("NQGZ9fwFMnU");
    expect(youtubeId("https://www.youtube.com/watch?list=x&v=NQGZ9fwFMnU")).toBe("NQGZ9fwFMnU");
    expect(youtubeId("https://youtu.be/NQGZ9fwFMnU?t=4")).toBe("NQGZ9fwFMnU");
    expect(youtubeId("https://www.youtube.com/shorts/abcDEF12345")).toBe("abcDEF12345");
    expect(youtubeId("https://example.org/watch?v=1")).toBeNull();
  });
  it("tells shorts from other videos by the title", () => {
    expect(isShort(item("a", "video", { title: "Rust in 60 seconds #shorts" }))).toBe(true);
    expect(isShort(item("a", "video", { title: "Short tips for Git" }))).toBe(true);
    expect(isShort(item("a", "video", { title: "Full course on Git" }))).toBe(false);
    expect(isShort(item("a", "article", { title: "#shorts" }))).toBe(false);
  });
  it("maps content types to the feed's kinds", () => {
    expect(kindOf({ type: "video" })).toBe("video");
    expect(kindOf({ type: "article" })).toBe("article");
    expect(kindOf({ type: "repo" })).toBe("repo");
    expect(kindOf({ type: "course" })).toBe("learn");
    expect(kindOf({ type: "exercise" })).toBe("learn");
    for (const k of Object.keys(KIND_TYPES)) expect(KIND_TYPES[k as ReelKind].length).toBeGreaterThan(0);
  });
});

describe("ReelsQueue", () => {
  it("follows the rhythm", async () => {
    const api = fakeApi({ video: 100, article: 100, repo: 100, learn: 100 }, make);
    const q = new ReelsQueue(api.fetchPage);
    const out = await q.next(RHYTHM.length);
    expect(out.map((i) => (i.id.startsWith("video") ? "video" : i.id.startsWith("article") ? "article" : i.id.startsWith("repo") ? "repo" : "learn"))).toEqual(RHYTHM);
  });

  it("never repeats an item, across calls and with a seed", async () => {
    const api = fakeApi({ video: 100, article: 100, repo: 100, learn: 100 }, make);
    const q = new ReelsQueue(api.fetchPage, ["video-0", "article-0"]);
    const all = [...(await q.next(15)), ...(await q.next(15))];
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    expect(all.map((i) => i.id)).not.toContain("video-0");
    expect(all.map((i) => i.id)).not.toContain("article-0");
  });

  it("fetches a page only when a buffer runs dry", async () => {
    const api = fakeApi({ video: 100, article: 100, repo: 100, learn: 100 }, make);
    const q = new ReelsQueue(api.fetchPage);
    await q.next(10);
    expect(api.calls.filter(([k]) => k === "video")).toHaveLength(1); // 6 videos came from one page of 20
  });

  it("skips a kind that has run out and keeps going", async () => {
    const api = fakeApi({ video: 100, article: 0, repo: 0, learn: 0 }, make);
    const q = new ReelsQueue(api.fetchPage);
    const out = await q.next(12);
    expect(out).toHaveLength(12);
    expect(out.every((i) => i.type === "video")).toBe(true);
  });

  it("ends when everything is exhausted, with fewer than asked", async () => {
    const api = fakeApi({ video: 3, article: 2, repo: 1, learn: 1 }, make);
    const q = new ReelsQueue(api.fetchPage);
    const out = await q.next(50);
    expect(out).toHaveLength(7);
    expect(q.exhausted).toBe(true);
    expect(await q.next(5)).toEqual([]);
  });

  it("leaves lectures and videos it cannot play out of the feed", async () => {
    const api = fakeApi({ video: 30, article: 0, repo: 0, learn: 0 }, (kind, i) =>
      i % 3 === 0 ? item(`lecture-${i}`, "video", { meta: { learn: true } })
        : i % 3 === 1 ? item(`broken-${i}`, "video", { url: "https://example.org/not-youtube" })
        : item(`ok-${i}`, "video"));
    const out = await new ReelsQueue(api.fetchPage).next(8);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => i.id.startsWith("ok-"))).toBe(true);
  });

  it("puts shorts ahead of other videos", async () => {
    const api = fakeApi({ video: 20, article: 0, repo: 0, learn: 0 }, (kind, i) => item(`v-${i}`, "video", { title: i >= 15 ? `Tip ${i} #shorts` : `Talk ${i}` }));
    const out = await new ReelsQueue(api.fetchPage).next(5);
    expect(out.every((i) => /#shorts/.test(i.title))).toBe(true);
  });

  it("keeps looking past a page with nothing usable", async () => {
    // First page: only lectures. Second: playable.
    const fetchPage = async (_k: ReelKind, offset: number, limit: number) =>
      Array.from({ length: limit }, (_, i) => (offset === 0 ? item(`l-${i}`, "video", { meta: { learn: true } }) : item(`p-${offset + i}`, "video")));
    const out = await new ReelsQueue(fetchPage).next(3);
    expect(out).toHaveLength(3);
    expect(out[0]!.id.startsWith("p-")).toBe(true);
  });
});

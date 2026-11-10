import type { ContentItem } from "../types/content";

/* The logic behind the vertical feed: what kinds of content it mixes, in what rhythm,
   and how it keeps a few items ready ahead of the viewer. No React here, so it is testable. */

export type ReelKind = "video" | "article" | "repo" | "learn";

/** Mostly short video, with a read, a project or a lesson between: it never becomes one long stream of one format. */
export const RHYTHM: ReelKind[] = ["video", "video", "article", "video", "repo", "video", "learn", "video", "article", "video"];

/** The API types behind each kind. */
export const KIND_TYPES: Record<ReelKind, string[]> = {
  video: ["video"],
  article: ["article"],
  repo: ["repo"],
  learn: ["course", "doc", "exercise"],
};

export const kindOf = (item: Pick<ContentItem, "type">): ReelKind =>
  item.type === "video" ? "video" : item.type === "repo" ? "repo" : item.type === "article" || item.type === "social_post" ? "article" : "learn";

/** A video made to be a short: its title says so. (Real durations are mostly unknown, so a guess from the length would be wrong.) */
export const isShort = (item: Pick<ContentItem, "title" | "type">) => item.type === "video" && /#shorts?\b|\bshorts?\b/i.test(item.title);

/** The YouTube id of a video item, from its address. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1]! : null;
}

/** Lectures and courses belong to Learn: the vertical feed is for things you can take in right now. */
const fitsFeed = (item: ContentItem) => (item.type === "video" ? !item.meta?.learn && !!youtubeId(item.url) : true);

type Fetcher = (kind: ReelKind, offset: number, limit: number) => Promise<ContentItem[]>;

const PAGE = 20;

/**
 * Hands out items in the rhythm above, fetching a page of a kind only when its buffer runs dry.
 * Items already handed out are never repeated, and a kind that has run out is skipped.
 */
export class ReelsQueue {
  private buffers: Record<ReelKind, ContentItem[]> = { video: [], article: [], repo: [], learn: [] };
  private offsets: Record<ReelKind, number> = { video: 0, article: 0, repo: 0, learn: 0 };
  private done: Record<ReelKind, boolean> = { video: false, article: false, repo: false, learn: false };
  private seen = new Set<string>();
  private cursor = 0;

  constructor(private fetchPage: Fetcher, seed: string[] = []) {
    seed.forEach((id) => this.seen.add(id));
  }

  get exhausted() {
    return (Object.keys(this.done) as ReelKind[]).every((k) => this.done[k] && this.buffers[k].length === 0);
  }

  private async refill(kind: ReelKind) {
    const rows = await this.fetchPage(kind, this.offsets[kind], PAGE);
    this.offsets[kind] += PAGE;
    if (rows.length < PAGE) this.done[kind] = true;
    const fresh = rows.filter((r) => fitsFeed(r) && !this.seen.has(r.id) && !this.buffers[kind].some((b) => b.id === r.id));
    // Shorts first: they are what this feed is for.
    this.buffers[kind].push(...(kind === "video" ? [...fresh.filter(isShort), ...fresh.filter((r) => !isShort(r))] : fresh));
  }

  /** Up to `n` more items. Fewer only when the content has run out. */
  async next(n: number): Promise<ContentItem[]> {
    const out: ContentItem[] = [];
    let idle = 0; // consecutive turns that produced nothing
    while (out.length < n && idle < RHYTHM.length) {
      const kind = RHYTHM[this.cursor++ % RHYTHM.length]!;
      // A page can hold nothing usable (all learn videos, say): keep going until a page does or the kind ends.
      while (this.buffers[kind].length === 0 && !this.done[kind]) await this.refill(kind);
      const item = this.buffers[kind].shift();
      if (!item) {
        idle++;
        continue;
      }
      idle = 0;
      this.seen.add(item.id);
      out.push(item);
    }
    return out;
  }
}

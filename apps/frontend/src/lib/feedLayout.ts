import { ContentItem } from "../types/content";

/** Roughly one in every 20-30 items comes from outside the learner's domains. */
export const WILDCARD_MIN = 20;
export const WILDCARD_SPAN = 11; // so the gap is 20..30

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export type SectionKind = "videos" | "repos" | "articles" | "opportunity";

export interface Section {
  kind: SectionKind;
  items: ContentItem[];
}

/** How many cards each row shows, and the order the formats alternate in:
 *  two bands of videos, a shelf of projects, two more bands of videos, then a
 *  shelf of reading. The rhythm is fixed so the page never feels random; change
 *  PATTERN to retune it. */
const ROW_SIZE: Record<SectionKind, number> = { videos: 4, repos: 3, articles: 3, opportunity: 1 };
/** A full-width opportunity band appears after this many bands. */
export const OPPORTUNITY_EVERY = 10;
const PATTERN: Array<Exclude<SectionKind, "opportunity">> = ["videos", "videos", "repos", "videos", "videos", "articles"];

/** Splits the feed by format and weaves the pieces into rows. A format that
 *  runs out is skipped, so a missing source never leaves a hole. With
 *  `keepPartial` off, only full rows are returned. */
export function buildSections(items: ContentItem[], keepPartial = true): Section[] {
  const regular = items.filter((i) => !i.wildcard);
  const queues: Record<SectionKind, ContentItem[]> = {
    videos: regular.filter((i) => i.type === "video"),
    repos: regular.filter((i) => i.type === "repo"),
    articles: regular.filter((i) => i.type === "article" || i.type === "social_post"),
    opportunity: regular.filter((i) => i.type === "opportunity"),
  };
  // Wildcards wait for a band of their own format, then take its last slot.
  const regularIds = new Set(regular.map((i) => i.id));
  const wild: Partial<Record<SectionKind, ContentItem[]>> = { videos: [], repos: [], articles: [] };
  const seenWild = new Set<string>();
  for (const w of items.filter((i) => i.wildcard && !regularIds.has(i.id))) {
    if (seenWild.has(w.id)) continue; // the same pick can come back on a later page
    seenWild.add(w.id);
    const kind: SectionKind | null = w.type === "video" ? "videos" : w.type === "repo" ? "repos" : w.type === "article" ? "articles" : null;
    if (kind) wild[kind]!.push(w);
  }
  let sinceWildcard = 0;
  const gap = (w?: ContentItem) => WILDCARD_MIN + (w ? hash(w.id) % WILDCARD_SPAN : 0);
  const sections: Section[] = [];
  let sinceOpportunity = 0;
  const push = (kind: SectionKind, take: ContentItem[]) => {
    if (kind !== "opportunity") {
      sinceWildcard += take.length;
      const candidate = wild[kind]?.[0];
      if (candidate && sinceWildcard >= gap(candidate) && take.length === ROW_SIZE[kind]) {
        take = [...take.slice(0, -1), wild[kind]!.shift()!]; // the band keeps its size
        sinceWildcard = 0;
      }
    }
    sections.push({ kind, items: take });
    if (kind !== "opportunity") sinceOpportunity++;
    // After every OPPORTUNITY_EVERY bands, one full-width opportunity (if any is left).
    if (sinceOpportunity >= OPPORTUNITY_EVERY && queues.opportunity.length) {
      sections.push({ kind: "opportunity", items: queues.opportunity.splice(0, 1) });
      sinceOpportunity = 0;
    }
  };
  let guard = 0;
  while ((queues.videos.length || queues.repos.length || queues.articles.length) && guard++ < 500) {
    for (const kind of PATTERN) {
      const take = queues[kind].splice(0, ROW_SIZE[kind]);
      // A half-empty row looks broken; hold it back while more pages may still fill it.
      if (take.length && (keepPartial || take.length === ROW_SIZE[kind])) push(kind, take);
    }
  }
  return sections;
}

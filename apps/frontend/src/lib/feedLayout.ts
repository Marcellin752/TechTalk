import { ContentItem } from "../types/content";

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
  const queues: Record<SectionKind, ContentItem[]> = {
    videos: items.filter((i) => i.type === "video"),
    repos: items.filter((i) => i.type === "repo"),
    articles: items.filter((i) => i.type !== "video" && i.type !== "repo" && i.type !== "opportunity"),
    opportunity: items.filter((i) => i.type === "opportunity"),
  };
  const sections: Section[] = [];
  let sinceOpportunity = 0;
  const push = (kind: SectionKind, take: ContentItem[]) => {
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

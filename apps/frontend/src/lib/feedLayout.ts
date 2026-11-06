import { ContentItem } from "../types/content";

export type SectionKind = "videos" | "repos" | "articles";

export interface Section {
  kind: SectionKind;
  items: ContentItem[];
}

/** How many cards each row shows, and the order the formats alternate in:
 *  a row of videos, then a shelf of projects, more videos, then reading. */
const ROW_SIZE: Record<SectionKind, number> = { videos: 4, repos: 3, articles: 3 };
const PATTERN: SectionKind[] = ["videos", "repos", "videos", "articles"];

/** Splits the feed by format and weaves the pieces into rows. A format that
 *  runs out is skipped, so a missing source never leaves a hole. With
 *  `keepPartial` off, only full rows are returned. */
export function buildSections(items: ContentItem[], keepPartial = true): Section[] {
  const queues: Record<SectionKind, ContentItem[]> = {
    videos: items.filter((i) => i.type === "video"),
    repos: items.filter((i) => i.type === "repo"),
    articles: items.filter((i) => i.type !== "video" && i.type !== "repo"),
  };
  const sections: Section[] = [];
  let guard = 0;
  while ((queues.videos.length || queues.repos.length || queues.articles.length) && guard++ < 500) {
    for (const kind of PATTERN) {
      const take = queues[kind].splice(0, ROW_SIZE[kind]);
      // A half-empty row looks broken; hold it back while more pages may still fill it.
      if (take.length && (keepPartial || take.length === ROW_SIZE[kind])) sections.push({ kind, items: take });
    }
  }
  return sections;
}

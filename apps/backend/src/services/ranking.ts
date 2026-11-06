import { desc, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { bookmarks, contents, githubProfiles, readingHistory } from '../db/schema.js';

type ContentRow = typeof contents.$inferSelect;

export interface RankSignals {
  /** Topics the user chose (category names). */
  interests: string[];
  /** Languages from their GitHub, each with its share of their work (0..1). */
  languages: Array<{ name: string; share: number }>;
  /** Category weights learned from what they saved and read. */
  affinity: Map<string, number>;
  readIds: Set<string>;
  now?: number;
}

export interface Ranked {
  score: number;
  /** One short sentence shown on the card, or null when nothing specific applies. */
  reason: string | null;
}

const DAY_MS = 86_400_000;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Words that mean a language in running text ("go" alone is too ambiguous). */
function languagePattern(name: string): RegExp {
  const n = name.toLowerCase();
  if (n === 'go') return /\bgolang\b/i;
  if (n === 'c') return /(?!)/; // a single letter matches everything; rely on categories instead
  if (n === 'c++') return /c\+\+/i;
  if (n === 'c#') return /c#|csharp/i;
  return new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i');
}

/** Scores one item for one user. Everything is additive and explainable, so the
 *  strongest contributor can be told back to the user as the reason. */
export function scoreContent(c: ContentRow, s: RankSignals): Ranked {
  const now = s.now ?? Date.now();
  const cats = c.categories ?? [];
  const meta = (c.meta ?? {}) as { language?: string | null; stars?: number };

  // Topics the user follows.
  const matchedInterests = cats.filter((x) => s.interests.includes(x));
  const interest = Math.min(2, matchedInterests.length) * 3;

  // Their programming languages.
  let language = 0;
  let languageName: string | null = null;
  for (const l of s.languages) {
    let hit = false;
    if (c.type === 'repo') hit = meta.language === l.name;
    else hit = languagePattern(l.name).test(`${c.title} ${c.summary ?? ''} ${cats.join(' ')}`);
    if (!hit) continue;
    const value = (c.type === 'repo' ? 2 : 1.5) + (c.type === 'repo' ? 6 : 3) * l.share;
    if (value > language) {
      language = value;
      languageName = l.name;
    }
  }

  // Similar to what they saved or read.
  let affinity = 0;
  let affinityCategory: string | null = null;
  for (const cat of cats) {
    const w = s.affinity.get(cat) ?? 0;
    affinity += w;
    if (w > 0 && (!affinityCategory || w > (s.affinity.get(affinityCategory) ?? 0))) affinityCategory = cat;
  }
  affinity = Math.min(4, affinity);

  const ageDays = Math.max(0, (now - new Date(c.createdAt).getTime()) / DAY_MS);
  const freshness = 3 * Math.pow(0.5, ageDays / 7);
  const popularity = c.type === 'repo' ? Math.min(2, Math.log10((meta.stars ?? 0) + 1) / 3) : 0;
  const seen = s.readIds.has(c.id) ? -6 : 0;

  const score = interest + language + affinity + freshness + popularity + seen;

  let reason: string | null = null;
  const best = Math.max(language, interest, affinity);
  if (best > 0) {
    if (language >= interest && language >= affinity && languageName) reason = `Because you code in ${languageName}`;
    else if (interest >= affinity && matchedInterests[0]) reason = `Because you follow ${matchedInterests[0]}`;
    else if (affinityCategory) reason = `Similar to what you saved or read (${affinityCategory})`;
  }
  return { score, reason };
}

/** Ranks a candidate pool, best first. Equal scores keep the newest first. */
export function rankContents(pool: ContentRow[], signals: RankSignals): Array<ContentRow & { reason: string | null }> {
  return pool
    .map((c) => ({ c, ...scoreContent(c, signals) }))
    .sort((a, b) => b.score - a.score || new Date(b.c.createdAt).getTime() - new Date(a.c.createdAt).getTime())
    .map(({ c, reason }) => ({ ...c, reason }));
}

/** Gathers everything we know about the user. Bookmarks weigh more than reads. */
export async function loadRankSignals(userId: string, interests: string[]): Promise<RankSignals> {
  const [profile] = await db.select({ languages: githubProfiles.languages }).from(githubProfiles).where(eq(githubProfiles.userId, userId)).limit(1);

  const saved = await db
    .select({ categories: contents.categories })
    .from(bookmarks)
    .innerJoin(contents, eq(contents.id, bookmarks.contentId))
    .where(eq(bookmarks.userId, userId))
    .limit(200);
  const read = await db
    .select({ id: readingHistory.contentId, categories: contents.categories })
    .from(readingHistory)
    .innerJoin(contents, eq(contents.id, readingHistory.contentId))
    .where(eq(readingHistory.userId, userId))
    .orderBy(desc(readingHistory.readAt))
    .limit(300);

  const affinity = new Map<string, number>();
  const add = (cats: string[] | null, weight: number) => {
    for (const c of cats ?? []) affinity.set(c, Math.min(3, (affinity.get(c) ?? 0) + weight));
  };
  for (const r of saved) add(r.categories, 0.6);
  for (const r of read) add(r.categories, 0.2);

  return {
    interests,
    languages: profile?.languages ?? [],
    affinity,
    readIds: new Set(read.map((r) => r.id)),
  };
}

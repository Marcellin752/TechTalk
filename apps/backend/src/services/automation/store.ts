import { sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';

/** What every provider hands over; one shape for videos, courses, papers, exercises… */
export interface ContentInput {
  title: string;
  url: string;
  source: string;
  type: string;
  summary: string;
  body?: string | null;
  categories: string[];
  image?: string | null;
  embedCode?: string | null;
  meta?: Record<string, unknown>;
}

/** Insert, or refresh the facts that change over time (stats, summary, picture).
 *  The ::text::jsonb cast avoids drizzle 0.30 + postgres-js double-encoding the object. */
export async function saveContent(row: ContentInput): Promise<void> {
  const meta = sql`${JSON.stringify(row.meta ?? {})}::text::jsonb`;
  await db
    .insert(contents)
    .values({
      title: row.title.replace(/\s+/g, ' ').trim().slice(0, 255),
      url: row.url.slice(0, 512),
      source: row.source.slice(0, 100),
      type: row.type,
      summary: row.summary,
      body: row.body ?? null,
      categories: row.categories,
      image: row.image ? row.image.slice(0, 1000) : null,
      embedCode: row.embedCode ?? null,
      meta,
    })
    .onConflictDoUpdate({ target: contents.url, set: { meta, summary: row.summary, image: row.image ?? null } });
}

/** Providers share a process-wide clock so an hourly cron does not re-poll slow sources. */
const lastRun = new Map<string, number>();
export function dueToRun(key: string, everyMs: number, force = false): boolean {
  const now = Date.now();
  if (!force && now - (lastRun.get(key) ?? 0) < everyMs) return false;
  lastRun.set(key, now);
  return true;
}

/** Translated duplicates (CS50 in Portuguese or Spanish…) are not for an English path. */
export function looksEnglish(title: string): boolean {
  if (/\b(em Portugu[eê]s|en Espa[nñ]ol|Aula \d|Clase \d|Lecci[oó]n|Le[cç]on|Lektion)\b/i.test(title)) return false;
  const letters = title.replace(/[^\p{L}]/gu, '');
  if (!letters) return true;
  const latin = letters.replace(/[^\u0000-\u024f]/g, '').length;
  return latin / letters.length > 0.85;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** Markdown/HTML to a short plain teaser. */
export function plainTeaser(text: string | null | undefined, max = 240): string {
  const plain = decodeEntities(String(text ?? ''))
    .replace(/<(script|style|pre)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard';

import { eq, isNull } from 'drizzle-orm';
import Parser from 'rss-parser';
import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { sanitizeHtmlContent } from '../../utils/html.js';
import { classifyContent } from '../../utils/classify.js';

const parser = new Parser();

const TECH_FEEDS = [
  { name: 'Dev.to', url: 'https://dev.to/feed' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
];

// Extracts username/slug from a dev.to URL like https://dev.to/username/slug
function parseDevToPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'dev.to') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

async function fetchDevToBody(url: string): Promise<string | null> {
  const path = parseDevToPath(url);
  if (!path) return null;
  const response = await fetch(`https://dev.to/api/articles/${path}`);
  if (!response.ok) return null;
  const data = await response.json() as any;
  return data.body_html || null;
}

/**
 * Fills in full bodies for contents that were ingested before the body column
 * existed. Runs as part of the hourly automation cron.
 */
export async function backfillMissingBodies(): Promise<void> {
  console.log('🔁 [Backfill] Fetching RSS bodies for lookup...');

  const rssBodies = new Map<string, string>();
  for (const feed of TECH_FEEDS) {
    try {
      const feedData = await parser.parseURL(feed.url);
      for (const item of feedData.items) {
        if (!item.link) continue;
        const contentHtml = item['content:encoded'] || item.content || '';
        if (contentHtml) {
          rssBodies.set(item.link, sanitizeHtmlContent(contentHtml));
        }
      }
      console.log(`📡 [Backfill] Parsed ${feed.name} feed`);
    } catch (error) {
      console.error(`❌ [Backfill] Error parsing feed ${feed.name}:`, error);
    }
  }

  const missing = await db.select().from(contents).where(isNull(contents.body));
  const uncategorized = await db.select().from(contents).where(isNull(contents.categories));
  console.log(`🎯 [Backfill] Found ${missing.length} contents without a body, ${uncategorized.length} without categories.`);

  for (const content of uncategorized) {
    await db.update(contents)
      .set({ categories: classifyContent(content.title, content.summary) })
      .where(eq(contents.id, content.id));
  }
  console.log(`✅ [Backfill] Assigned categories to ${uncategorized.length} contents.`);

  let updated = 0;
  let failed = 0;

  for (const content of missing) {
    let body: string | null = null;

    if (rssBodies.has(content.url)) {
      body = rssBodies.get(content.url)!;
    }
    if (!body && content.source.toLowerCase().includes('dev.to')) {
      body = await fetchDevToBody(content.url);
    }

    if (body) {
      await db.update(contents)
        .set({ body })
        .where(eq(contents.id, content.id));
      updated++;
    } else {
      failed++;
    }

    // Be gentle with the sources
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`✅ [Backfill] Done. Updated ${updated} bodies, skipped ${failed}.`);
}

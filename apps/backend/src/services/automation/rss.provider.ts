import Parser from 'rss-parser';
import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { sanitizeHtmlContent } from '../../utils/html.js';

const parser = new Parser();

// Tech RSS feeds list to feed TechTalk
const TECH_FEEDS = [
  { name: 'Dev.to', url: 'https://dev.to/feed' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' }
];

// Pulls a thumbnail from an RSS item: enclosure, then first <img> in content
function extractImage(item: any): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  const content = item['content:encoded'] || item.content || '';
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Fetches data from configured RSS feeds and puts them into the 'contents' table
 */
export async function fetchLiveRSSFeeds(): Promise<void> {
  console.log('🔄 [RSS Provider] Starting RSS scraping...');

  for (const feed of TECH_FEEDS) {
    try {
      console.log(`📡 [RSS Provider] Fetching feed from: ${feed.name}`);
      const feedData = await parser.parseURL(feed.url);

      for (const item of feedData.items) {
        if (!item.title || !item.link) continue;

        const image = extractImage(item);
        const contentHtml = item['content:encoded'] || item.content || '';
        const body = contentHtml ? sanitizeHtmlContent(contentHtml) : null;

        // Inserting into 'contents' database table. Prevents duplicates using url conflict check.
        await db.insert(contents).values({
          title: item.title,
          url: item.link,
          source: feed.name,
          type: 'article',
          summary: item.contentSnippet || item.content || '',
          body,
          image,
        }).onConflictDoNothing({ target: contents.url });
      }

      console.log(`✅ [RSS Provider] Successfully processed feed: ${feed.name}`);
    } catch (error) {
      console.error(`❌ [RSS Provider] Error scraping feed ${feed.name}:`, error);
    }
  }
}

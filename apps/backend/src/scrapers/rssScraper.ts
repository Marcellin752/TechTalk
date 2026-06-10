import Parser from 'rss-parser';
import { db } from '../db/db.js';
import { articles } from '../db/schema.js';

const parser = new Parser();

// Liste des flux RSS tech pour alimenter TechTalk
const TECH_FEEDS = [
  { name: 'Dev.to', url: 'https://dev.to/feed' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' }
];

export async function scrapeRSSFeeds() {
  console.log('🔄 Starting RSS scraping...');

  for (const feed of TECH_FEEDS) {
    try {
      console.log(`📡 Fetching feed from: ${feed.name}`);
      const feedData = await parser.parseURL(feed.url);

      for (const item of feedData.items) {
        if (!item.title || !item.link) continue;

        // Insertion en base de données. Évite les doublons grâce au lien unique de l'article.
        await db.insert(articles).values({
          title: item.title,
          url: item.link,
          source: 'rss',
          content: item.contentSnippet || item.content || '',
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        }).onConflictDoNothing({ target: articles.url });
      }

      console.log(`✅ Successfully processed feed: ${feed.name}`);
    } catch (error) {
      console.error(`❌ Error scraping feed ${feed.name}:`, error);
    }
  }
}

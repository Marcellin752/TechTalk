import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { sanitizeHtmlContent } from '../../utils/html.js';

/**
 * Fetches latest technical articles from Dev.to public API and inserts them into the database.
 */
export async function fetchLiveDevToArticles(): Promise<void> {
  console.log('[Automation Worker] Fetching live articles from Dev.to API...');

  try {
    const response = await fetch('https://dev.to/api/articles?tag=typescript&per_page=5');
    if (!response.ok) {
      throw new Error(`Dev.to API responded with status: ${response.status}`);
    }

    const articles = await response.json() as any[];
    let insertedCount = 0;

    for (const article of articles) {
      const item = {
        title: article.title,
        url: article.url,
        source: 'Dev.to',
        type: 'article',
        summary: article.description || 'No description available.',
        body: article.body_html ? sanitizeHtmlContent(article.body_html) : null,
        image: article.social_image || article.cover_image || null,
        embedCode: null
      };

      const result = await db.insert(contents)
        .values(item)
        .onConflictDoNothing({ target: contents.url })
        .returning();

      if (result && result.length > 0) {
        insertedCount++;
      }
    }

    console.log(`[Automation Worker] Dev.to task completed. Added ${insertedCount} new articles.`);
  } catch (error) {
    console.error('[Automation Worker] Error fetching from Dev.to:', error);
  }
}

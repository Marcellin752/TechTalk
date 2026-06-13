import cron from 'node-cron';
import { db } from '../db/db.js';
import { contents } from '../db/schema.js';

/**
 * Fetches real, live articles from the Dev.to public API
 */
async function fetchLiveDevToArticles() {
  console.log('[Automation Worker] Fetching live articles from Dev.to API...');

  try {
    // Fetching the latest 10 articles tagged with 'typescript'
    const response = await fetch('https://dev.to/api/articles?tag=typescript&per_page=10');
    
    if (!response.ok) {
      throw new Error(`Dev.to API responded with status: ${response.status}`);
    }

    const articles = await response.json() as any[];
    let insertedCount = 0;

    for (const article of articles) {
      // Map the Dev.to API structure to our Drizzle database schema
      const item = {
        title: article.title,
        url: article.url,
        source: 'Dev.to',
        type: 'article',
        summary: article.description || 'No description available.',
        embedCode: null
      };

      // Insert and safely ignore duplicates based on the URL constraint
      const result = await db.insert(contents)
        .values(item)
        .onConflictDoNothing({ target: contents.url });

      if (result.rowCount && result.rowCount > 0) {
        insertedCount++;
      }
    }

    console.log(`[Automation Worker] Dev.to task completed. Successfully added ${insertedCount} new articles.`);
  } catch (error) {
    console.error('[Automation Worker] Error fetching from Dev.to:', error);
  }
}

export function initAutomationWorkers() {
  console.log('🤖 [Automation] Background workers initialized.');

  // Runs every hour to pull fresh technical articles
  cron.schedule('*/5 * * * * *', async () => {
    await fetchLiveDevToArticles();
  });
}
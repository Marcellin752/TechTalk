import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';

const REDDIT_SUBREDDITS = ['programming', 'technology', 'webdev'];

/**
 * Fetches top tech posts from configured Reddit subreddits and inserts them into the database.
 */
export async function fetchLiveRedditPosts(): Promise<void> {
  console.log('🔄 [Reddit Provider] Starting Reddit scraping...');

  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      console.log(`📡 [Reddit Provider] Fetching top posts from: r/${subreddit}`);
      
      const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=5`, {
        headers: {
          'User-Agent': 'TechTalk/1.0 (by /u/teachtalk-team)',
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit API responded with status: ${response.status}`);
      }

      const data = await response.json() as any;
      const posts = data.data?.children || [];
      let insertedCount = 0;

      for (const post of posts) {
        const itemData = post.data;
        if (!itemData.title || !itemData.permalink) continue;

        // Construct canonical url and ensure correct format
        const canonicalUrl = `https://www.reddit.com${itemData.permalink}`;

        const item = {
          title: itemData.title,
          url: canonicalUrl,
          source: 'Reddit',
          type: 'article', // Reddit posts are mapped to articles for simplicity
          summary: itemData.selftext || `Discussion link: ${itemData.url}`,
          embedCode: null,
        };

        const result = await db.insert(contents)
          .values(item)
          .onConflictDoNothing({ target: contents.url })
          .returning();

        if (result && result.length > 0) {
          insertedCount++;
        }
      }

      console.log(`✅ [Reddit Provider] Successfully processed r/${subreddit}. Added ${insertedCount} new posts.`);
    } catch (error) {
      console.error(`❌ [Reddit Provider] Error scraping r/${subreddit}:`, error);
    }
  }
}

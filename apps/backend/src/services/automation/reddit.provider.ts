import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { config } from '../../config/env.js';
import { markdownToHtml } from '../../utils/html.js';
import { classifyContent } from '../../utils/classify.js';

const REDDIT_SUBREDDITS = ['programming', 'technology', 'webdev'];

const USER_AGENT = 'TechTalk/1.0 (by /u/teachtalk-team)';

/**
 * Fetches a Reddit OAuth2 access token using the client credentials grant.
 * Unauthenticated public endpoints are blocked on cloud/datacenter IPs,
 * so we route all requests through the authenticated oauth.reddit.com API.
 */
async function getRedditAccessToken(): Promise<string | null> {
  const clientId = config.scrapers.redditClientId;
  const clientSecret = config.scrapers.redditClientSecret;

  if (!clientId || !clientSecret) {
    console.warn('[Reddit Provider] Skipping auth: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are missing in .env');
    return null;
  }

  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Reddit OAuth responded with status: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.access_token || null;
  } catch (error) {
    console.error('❌ [Reddit Provider] Error obtaining Reddit OAuth token:', error);
    return null;
  }
}

/**
 * Fetches top tech posts from configured Reddit subreddits and inserts them into the database.
 */
export async function fetchLiveRedditPosts(): Promise<void> {
  console.log('🔄 [Reddit Provider] Starting Reddit scraping...');

  const accessToken = await getRedditAccessToken();
  if (!accessToken) {
    console.warn('[Reddit Provider] Skipping Reddit sync: no valid access token available.');
    return;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': USER_AGENT,
  };

  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      console.log(`📡 [Reddit Provider] Fetching top posts from: r/${subreddit}`);

      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/top.json?limit=5`, { headers });

      if (!response.ok) {
        throw new Error(`Reddit API responded with status: ${response.status}`);
      }

      const data = await response.json() as any;
      const posts = data.data?.children || [];
      let insertedCount = 0;

      for (const post of posts) {
        const itemData = post.data;
        if (!itemData.title || !itemData.permalink) continue;

        const canonicalUrl = `https://www.reddit.com${itemData.permalink}`;

        const thumbnail = itemData.thumbnail;
        const image = thumbnail && /^https?:\/\//.test(thumbnail) ? thumbnail : null;

        const item = {
          title: itemData.title,
          url: canonicalUrl,
          source: 'Reddit',
          type: 'article',
          summary: itemData.selftext || `Discussion link: ${itemData.url}`,
          body: itemData.selftext ? markdownToHtml(itemData.selftext) : null,
          categories: classifyContent(itemData.title, itemData.selftext),
          image,
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
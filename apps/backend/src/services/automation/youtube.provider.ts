import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';

/**
 * Fetches latest videos from a specific YouTube Channel using YouTube Data API v3.
 */
export async function fetchLiveYouTubeVideos(): Promise<void> {
  console.log('[Automation Worker] Fetching live videos from YouTube API...');
  
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[Automation Worker] Skipping YouTube sync: YOUTUBE_API_KEY is missing in .env');
    return;
  }

  // Example: Google Developers Channel ID. Replace with any tech channel ID you love.
  const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; 
  const maxResults = 5;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API responded with status: ${response.status}`);
    }

    const data = await response.json() as any;
    const videos = data.items || [];
    let insertedCount = 0;

    for (const video of videos) {
      const videoId = video.id?.videoId;
      if (!videoId) continue; 

      const snippet = video.snippet;

      const item = {
        title: snippet.title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        source: 'YouTube',
        type: 'video',
        summary: snippet.description || 'No description available.',
        image: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
        embedCode: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
      };

      const result = await db.insert(contents)
        .values(item)
        .onConflictDoNothing({ target: contents.url })
        .returning();

      if (result && result.length > 0) {
        insertedCount++;
      }
    }

    console.log(`[Automation Worker] YouTube task completed. Added ${insertedCount} new videos.`);
  } catch (error) {
    console.error('[Automation Worker] Error fetching from YouTube:', error);
  }
}

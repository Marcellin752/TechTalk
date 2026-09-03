import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { classifyContent } from '../../utils/classify.js';

interface VideoItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string | null;
}

async function insertVideos(videos: VideoItem[]): Promise<number> {
  let inserted = 0;

  for (const v of videos) {
    const result = await db.insert(contents).values({
      title: v.title,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      source: v.channelTitle,
      type: 'video',
      summary: v.description || 'No description available.',
      categories: classifyContent(v.title, v.description),
      image: v.thumbnail,
      embedCode: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${v.videoId}" frameborder="0" allowfullscreen></iframe>`,
    }).onConflictDoNothing({ target: contents.url }).returning();

    if (result.length > 0) inserted++;
  }

  return inserted;
}

export async function fetchLiveYouTubeVideos(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[Automation Worker] Skipping YouTube sync: YOUTUBE_API_KEY is missing in .env');
    return;
  }

  const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
  const maxResults = 5;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API responded with status: ${response.status}`);
    }

    const data = await response.json() as any;
    const videos: VideoItem[] = (data.items || []).map((video: any) => ({
      videoId: video.id?.videoId || '',
      title: video.snippet.title,
      description: video.snippet.description || '',
      channelTitle: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || null,
    })).filter((v: VideoItem) => v.videoId);

    const inserted = await insertVideos(videos);
    console.log(`[Automation Worker] YouTube task completed. Added ${inserted} new videos.`);
  } catch (error) {
    console.error('[Automation Worker] Error fetching from YouTube:', error);
  }
}

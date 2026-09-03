import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { classifyContent } from '../../utils/classify.js';

const CHANNELS = (process.env.YOUTUBE_CHANNELS || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

const KEYWORDS = (process.env.YOUTUBE_KEYWORDS || 'programming,web development,typescript,javascript,AI technology')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const MAX_RESULTS = parseInt(process.env.YOUTUBE_MAX_RESULTS || '10', 10);

interface VideoItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string | null;
}

async function fetchVideosForKeyword(
  apiKey: string,
  keyword: string,
  existingIds: Set<string>,
): Promise<{ videos: VideoItem[]; consumed: number }> {
  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: String(MAX_RESULTS),
    order: 'date',
    type: 'video',
    q: keyword,
    relevanceLanguage: 'en',
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const videos: VideoItem[] = [];

  for (const item of data.items || []) {
    const videoId = item.id?.videoId;
    if (!videoId || existingIds.has(videoId)) continue;
    existingIds.add(videoId);

    videos.push({
      videoId,
      title: item.snippet.title,
      description: item.snippet.description || '',
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.default?.url
        || null,
    });
  }

  return { videos, consumed: 100 };
}

async function fetchVideosForChannel(
  apiKey: string,
  channelId: string,
  existingIds: Set<string>,
): Promise<{ videos: VideoItem[]; consumed: number }> {
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    maxResults: String(MAX_RESULTS),
    order: 'date',
    type: 'video',
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error for channel ${channelId}: ${response.status}`);
  }

  const data = await response.json() as any;
  const videos: VideoItem[] = [];

  for (const item of data.items || []) {
    const videoId = item.id?.videoId;
    if (!videoId || existingIds.has(videoId)) continue;
    existingIds.add(videoId);

    videos.push({
      videoId,
      title: item.snippet.title,
      description: item.snippet.description || '',
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.default?.url
        || null,
    });
  }

  return { videos, consumed: 100 };
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
    console.warn('[YouTube] Skipped: YOUTUBE_API_KEY is not set');
    return;
  }

  console.log(`[YouTube] Fetching with keywords: ${KEYWORDS.join(', ')}`
    + (CHANNELS.length ? ` and channels: ${CHANNELS.join(', ')}` : ''));

  const seenIds = new Set<string>();
  const allVideos: VideoItem[] = [];
  let totalQuota = 0;

  const keywordTasks = KEYWORDS.map((kw) =>
    fetchVideosForKeyword(apiKey, kw, seenIds).then((r) => {
      totalQuota += r.consumed;
      allVideos.push(...r.videos);
    }).catch((err) => {
      console.error(`[YouTube] Keyword "${kw}" failed:`, err.message);
    })
  );

  const channelTasks = CHANNELS.map((ch) =>
    fetchVideosForChannel(apiKey, ch, seenIds).then((r) => {
      totalQuota += r.consumed;
      allVideos.push(...r.videos);
    }).catch((err) => {
      console.error(`[YouTube] Channel "${ch}" failed:`, err.message);
    })
  );

  await Promise.all([...keywordTasks, ...channelTasks]);

  if (allVideos.length === 0) {
    console.log('[YouTube] No new videos found.');
    return;
  }

  const inserted = await insertVideos(allVideos);
  console.log(`[YouTube] Done. ${inserted} new video(s) inserted.`);
}

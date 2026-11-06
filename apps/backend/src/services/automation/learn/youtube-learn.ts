import { config } from '../../../config/env.js';
import { classifyContent } from '../../../utils/classify.js';
import { decodeEntities, looksEnglish, plainTeaser, saveContent } from '../store.js';

/* Course-length videos from channels that teach. Quota-friendly: a channel's
   uploads form a playlist (id = "UU" + channel id without "UC"), so reading it
   with playlistItems costs 1 unit, against 100 for a search. Three units per
   channel in all (channel, playlist page, durations). */

const DEFAULT_CHANNELS = ['@cs50', '@freecodecamp', '@mitocw', '@Fireship', '@NeetCode'];
const MIN_SECONDS = 8 * 60; // skip shorts and trailers: this section is for lessons
const API = 'https://www.googleapis.com/youtube/v3';

/** ISO 8601 duration ("PT1H2M3S") to seconds. */
export function isoToSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

export function uploadsPlaylistId(channelId: string): string {
  return channelId.replace(/^UC/, 'UU');
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: config.scrapers.youtubeApiKey ?? '' })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube ${path} responded with ${res.status}`);
  return (await res.json()) as T;
}

function channelHandles(): string[] {
  const raw = process.env.YOUTUBE_LEARN_CHANNELS;
  return raw ? raw.split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_CHANNELS;
}

export async function fetchLearningVideos(): Promise<number> {
  if (!config.scrapers.youtubeApiKey) {
    console.warn('[Automation Worker] YOUTUBE_API_KEY is not set, skipping learning videos.');
    return 0;
  }
  let saved = 0;
  for (const handle of channelHandles()) {
    try {
      const ch = await yt<{ items?: Array<{ id: string; snippet: { title: string } }> }>('channels', { part: 'snippet', forHandle: handle });
      const channel = ch.items?.[0];
      if (!channel) continue;
      const list = await yt<{ items?: Array<{ contentDetails: { videoId: string } }> }>('playlistItems', {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId(channel.id),
        maxResults: '50',
      });
      const ids = (list.items ?? []).map((i) => i.contentDetails.videoId);
      if (ids.length === 0) continue;
      const vids = await yt<{
        items?: Array<{
          id: string;
          snippet: { title: string; description: string; thumbnails: Record<string, { url: string }>; publishedAt: string };
          contentDetails: { duration: string };
          statistics?: { viewCount?: string };
        }>;
      }>('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') });

      for (const v of vids.items ?? []) {
        const seconds = isoToSeconds(v.contentDetails.duration);
        if (seconds < MIN_SECONDS) continue;
        const title = decodeEntities(v.snippet.title);
        if (!looksEnglish(title)) continue; // translated duplicates (CS50 in Spanish, Portuguese…)
        await saveContent({
          title,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          source: channel.snippet.title,
          type: 'video',
          summary: plainTeaser(v.snippet.description, 400) || title,
          categories: classifyContent(title, v.snippet.description),
          image: v.snippet.thumbnails.high?.url ?? v.snippet.thumbnails.medium?.url ?? null,
          embedCode: `<iframe src="https://www.youtube.com/embed/${v.id}" allowfullscreen></iframe>`,
          meta: { learn: true, channel: channel.snippet.title, handle, durationSeconds: seconds, views: Number(v.statistics?.viewCount ?? 0), publishedAt: v.snippet.publishedAt },
        });
        saved++;
      }
    } catch (err) {
      console.error(`[Automation Worker] Learning channel ${handle} failed:`, (err as Error).message);
    }
  }
  return saved;
}

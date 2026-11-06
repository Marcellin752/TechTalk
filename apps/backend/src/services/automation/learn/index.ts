import { dueToRun } from '../store.js';
import { fetchRoadmaps } from './roadmaps.js';
import { fetchCurricula } from './curricula.js';
import { fetchMdn } from './mdn.js';
import { fetchArxiv } from './arxiv.js';
import { fetchLearningVideos } from './youtube-learn.js';
import { fetchDatacamp } from './datacamp.js';

const EVERY_MS = 12 * 60 * 60 * 1000;

/** Everything for the Learn section. Sources are independent: one failing never blocks the rest. */
export async function fetchLiveLearning(force = false): Promise<void> {
  if (!dueToRun('learn', EVERY_MS, force)) return;
  console.log('[Automation Worker] Fetching learning content...');
  const results = await Promise.allSettled([
    fetchRoadmaps().then((n) => `roadmaps ${n}`),
    fetchCurricula().then((r) => `courses ${r.courses}, fCC articles ${r.articles}`),
    fetchMdn().then((n) => `MDN ${n}`),
    fetchDatacamp().then((n) => `DataCamp ${n}`),
    fetchLearningVideos().then((n) => `videos ${n}`),
    fetchArxiv().then((n) => `papers ${n}`), // slowest (rate limited), runs alongside the others
  ]);
  const report = results.map((r) => (r.status === 'fulfilled' ? r.value : `failed (${(r.reason as Error).message})`));
  console.log(`[Automation Worker] Learning: ${report.join(' | ')}.`);
}

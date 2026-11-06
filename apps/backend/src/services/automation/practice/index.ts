import { dueToRun } from '../store.js';
import { fetchCodewars } from './codewars.js';
import { fetchCodeforces } from './codeforces.js';
import { fetchStackOverflow } from './stackexchange.js';
import { fetchCodinGame } from './codingame.js';

const EVERY_MS = 24 * 60 * 60 * 1000;

/** Everything for the Practice section; the sources are independent of each other. */
export async function fetchLivePractice(force = false): Promise<void> {
  if (!dueToRun('practice', EVERY_MS, force)) return;
  console.log('[Automation Worker] Fetching practice content...');
  const results = await Promise.allSettled([
    fetchCodewars().then((n) => `Codewars ${n}`),
    fetchCodeforces().then((n) => `Codeforces ${n}`),
    fetchStackOverflow().then((n) => `Stack Overflow ${n}`),
    fetchCodinGame().then((n) => `CodinGame ${n}`),
  ]);
  const report = results.map((r) => (r.status === 'fulfilled' ? r.value : `failed (${(r.reason as Error).message})`));
  console.log(`[Automation Worker] Practice: ${report.join(' | ')}.`);
}

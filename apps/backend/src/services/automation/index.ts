import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';
import { fetchLiveRedditPosts } from './reddit.provider.js';
import { fetchLiveGithubRepos } from './github.provider.js';
import { fetchLiveOpportunities } from './opportunities.provider.js';
import { fetchLiveLearning } from './learn/index.js';
import { fetchLivePractice } from './practice/index.js';
import { purgeRefreshTokens } from '../session.js';
import { backfillMissingBodies } from './backfill.provider.js';

/**
 * Orchestrates and executes all data fetching providers sequentially
 */
export const syncState = { running: false, startedAt: null as Date | null, finishedAt: null as Date | null, lastError: null as string | null };

/** Starts a sync unless one is already running. Returns false when it declined. */
export function startSync(): boolean {
  if (syncState.running) return false;
  runAllAutomationProviders().catch((err) => console.error('[Automation Engine] Manual sync failed:', err));
  return true;
}

async function runAllAutomationProviders(): Promise<void> {
  if (syncState.running) return;
  syncState.running = true;
  syncState.startedAt = new Date();
  syncState.lastError = null;
  try {
    await runProviders();
  } catch (err) {
    syncState.lastError = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    syncState.running = false;
    syncState.finishedAt = new Date();
  }
}

async function runProviders(): Promise<void> {
  console.log('[Automation Engine] Starting sequential sync across all sources...');
  
  await fetchLiveDevToArticles();
  await fetchLiveYouTubeVideos();
  await fetchLiveRedditPosts();
  await fetchLiveGithubRepos();
  await fetchLiveOpportunities();
  await fetchLiveLearning();
  await fetchLivePractice();
  await backfillMissingBodies();
  
  console.log('[Automation Engine] All sync tasks successfully finished.');
}

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('[Automation] Multi-source background workers initialized.');

  runAllAutomationProviders().catch((err) => {
    console.error('[Automation Engine] Error during initial startup sync:', err);
  });

  // Spent and expired refresh tokens are useless: clear them once a day.
  cron.schedule('30 3 * * *', () => {
    purgeRefreshTokens().catch((err) => console.error('[Sessions] purge failed:', err));
  });

  cron.schedule('0 * * * *', async () => {
    await runAllAutomationProviders();
  });
}

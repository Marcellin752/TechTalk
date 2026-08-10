import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';
import { fetchLiveRedditPosts } from './reddit.provider.js';
import { backfillMissingBodies } from './backfill.provider.js';

/**
 * Orchestrates and executes all data fetching providers sequentially
 */
async function runAllAutomationProviders(): Promise<void> {
  console.log('[Automation Engine] Starting sequential sync across all sources...');
  
  await fetchLiveDevToArticles();
  await fetchLiveYouTubeVideos();
  await fetchLiveRedditPosts();
  await backfillMissingBodies();
  
  console.log('✅ [Automation Engine] All sync tasks successfully finished.');
}

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('[Automation] Multi-source background workers initialized.');

  runAllAutomationProviders().catch((err) => {
    console.error('❌ [Automation Engine] Error during initial startup sync:', err);
  });

  cron.schedule('0 * * * *', async () => {
    await runAllAutomationProviders();
  });
}

import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';
import { fetchLiveRSSFeeds } from './rss.provider.js'; // 1. Added RSS import
import { fetchLiveRedditPosts } from './reddit.provider.js';
import { backfillMissingBodies } from './backfill.provider.js';

/**
 * Orchestrates and executes all data fetching providers sequentially
 */
async function runAllAutomationProviders(): Promise<void> {
  console.log('[Automation Engine] Starting sequential sync across all sources...');
  
  // Running sequentially prevents database connection overhead and race conditions
  await fetchLiveDevToArticles();
  await fetchLiveYouTubeVideos();
  await fetchLiveRSSFeeds(); // 2. Added RSS execution
  await fetchLiveRedditPosts();
  await backfillMissingBodies();
  
  console.log('✅ [Automation Engine] All sync tasks successfully finished.');
}

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('[Automation] Multi-source background workers initialized.');

  // 1. Immediate Execution on Startup
  runAllAutomationProviders().catch((err) => {
    console.error('❌ [Automation Engine] Error during initial startup sync:', err);
  });

  // 2. Production Schedule: Runs once every hour ('0 * * * *')
  cron.schedule('0 * * * *', async () => {
    await runAllAutomationProviders();
  });
}

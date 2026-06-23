import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';

/**
 * Orchestrates and executes all data fetching providers sequentially
 */
async function runAllAutomationProviders(): Promise<void> {
  console.log('⚡ [Automation Engine] Starting sequential sync across all sources...');
  
  // Running sequentially prevents database connection overhead and race conditions
  await fetchLiveDevToArticles();
  await fetchLiveYouTubeVideos();
  
  console.log('✅ [Automation Engine] All sync tasks successfully finished.');
}

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('🤖 [Automation] Multi-source background workers initialized.');

  // 1. Immediate Execution on Startup
  // This ensures the database is populated as soon as the server boots up!
  runAllAutomationProviders().catch((err) => {
    console.error('❌ [Automation Engine] Error during initial startup sync:', err);
  });

  // 2. Production Schedule: Runs once every hour ('0 * * * *')
  // This preserves your daily Google API quota perfectly.
  cron.schedule('0 * * * *', async () => {
    await runAllAutomationProviders();
  });
}

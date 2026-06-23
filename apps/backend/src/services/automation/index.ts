import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('🤖 [Automation] Multi-source background workers initialized.');

  // Temporary Test Schedule: Runs every 15 seconds for verification
  cron.schedule('*/15 * * * * *', async () => {
    await fetchLiveDevToArticles();
    await fetchLiveYouTubeVideos();
  });

  /* // Production Schedule: Runs once every hour to preserve API quotas
  cron.schedule('0 * * * *', async () => {
    await fetchLiveDevToArticles();
    await fetchLiveYouTubeVideos();
  });
  */
}

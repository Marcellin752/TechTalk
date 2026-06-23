import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';

/**
 * Initializes and schedules background automation tasks for all providers.
 */
export function initAutomationWorkers(): void {
  console.log('🤖 [Automation] Multi-source background workers initialized.');

  // Production Schedule: Runs once every hour to preserve API quotas
  cron.schedule('0 * * * *', async () => {
    await fetchLiveDevToArticles();
    await fetchLiveYouTubeVideos();
  });
}

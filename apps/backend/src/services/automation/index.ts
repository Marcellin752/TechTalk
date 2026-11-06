import cron from 'node-cron';
import { fetchLiveDevToArticles } from './devto.provider.js';
import { fetchLiveYouTubeVideos } from './youtube.provider.js';
import { fetchLiveRedditPosts } from './reddit.provider.js';
import { fetchLiveGithubRepos } from './github.provider.js';
import { fetchLiveOpportunities } from './opportunities.provider.js';
import { fetchLiveLearning } from './learn/index.js';
import { fetchLivePractice } from './practice/index.js';
import { backfillMissingBodies } from './backfill.provider.js';
import { rebuildTagUsageCounts, tagUntaggedContents } from '../taxonomy.js';

/**
 * Orchestrates and executes all data fetching providers sequentially
 */
async function runAllAutomationProviders(): Promise<void> {
  console.log('[Automation Engine] Starting sequential sync across all sources...');
  
  await fetchLiveDevToArticles();
  await fetchLiveYouTubeVideos();
  await fetchLiveRedditPosts();
  await fetchLiveGithubRepos();
  await fetchLiveOpportunities();
  await fetchLiveLearning();
  await fetchLivePractice();
  await backfillMissingBodies();

  // Providers write their own labels; anything that arrived untagged is caught
  // here, so tags never depend on a provider remembering to call the service.
  const tagged = await tagUntaggedContents();
  if (tagged > 0) {
    await rebuildTagUsageCounts();
    console.log(`[Automation Engine] Tagged ${tagged} contents.`);
  }
  
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

  cron.schedule('0 * * * *', async () => {
    await runAllAutomationProviders();
  });
}

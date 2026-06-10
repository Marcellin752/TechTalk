import { scrapeRSSFeeds } from './rssScraper.js';

export async function runAllScrapers() {
  console.log('🚀 --- STARTING ALL SCRAPERS ---');
  
  // Exécution de ton premier scraper
  await scrapeRSSFeeds();
  
  console.log('🏁 --- ALL SCRAPERS FINISHED ---');
}

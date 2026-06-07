import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("❌ CRITICAL: DATABASE_URL is missing in your .env file!");
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-fallback-key',
  scrapers: {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    redditClientId: process.env.REDDIT_CLIENT_ID,
  }
};

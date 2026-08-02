import dotenv from 'dotenv';
dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`CRITICAL: ${name} is missing in your .env file!`);
  }
  return value;
};

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:5173',
  scrapers: {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
  },
};

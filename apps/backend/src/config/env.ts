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
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  github: {
    // Read-only public data; no scope needed. Without it GitHub allows 60 req/h.
    token: process.env.GITHUB_TOKEN,
    topics: (process.env.GITHUB_TOPICS || 'typescript,javascript,react,python,rust,go,ai,machine-learning,devops')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    minStars: parseInt(process.env.GITHUB_MIN_STARS || '100', 10),
    maxPerTopic: parseInt(process.env.GITHUB_MAX_PER_TOPIC || '10', 10),
  },
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:5173',
  scrapers: {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
  },
};

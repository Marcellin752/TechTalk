import dotenv from 'dotenv';
dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`CRITICAL: ${name} is missing in your .env file!`);
  }
  return value;
};

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

// A server that boots with a placeholder secret or the wrong public address is worse
// than one that refuses to start, so production is checked strictly.
if (isProduction) {
  const problems: string[] = [];
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || /your_jwt_secret|changeme|secret_key_here/i.test(secret)) {
    problems.push('JWT_SECRET must be a random string of at least 32 characters');
  }
  if (!process.env.FRONTEND_URL || /localhost|127\.0\.0\.1/.test(process.env.FRONTEND_URL)) {
    problems.push('FRONTEND_URL must be the public address of the website (CORS)');
  }
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 12) {
    problems.push('ADMIN_PASSWORD must be at least 12 characters in production');
  }
  if (problems.length) {
    throw new Error(`CRITICAL: unsafe production configuration:\n - ${problems.join('\n - ')}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  // Optional first administrator, created or updated by `npm run db:seed`.
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  // Kairos, the AI mentor. Keys stay on the server. Providers are tried in order: the
  // chosen one first, then the other as a fallback when it is rate-limited or down.
  llm: {
    provider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '25000', 10),
    dailyMessageLimit: parseInt(process.env.KAIROS_DAILY_LIMIT || '120', 10),
  },
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
  // Public address of the website, used in the sitemap and social previews.
  siteUrl: process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:5173',
  scrapers: {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
  },
  // Object storage for student uploads. The defaults match docker-compose.yml
  // (Minikio on the host); production must set every one of these.
  storage: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'techtalk-documents',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'teachtalk',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'techtalk_secret',
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_MB || '25', 10) * 1024 * 1024,
    signedUrlTtlSeconds: parseInt(process.env.SIGNED_URL_TTL_SECONDS || '300', 10),
  },
};

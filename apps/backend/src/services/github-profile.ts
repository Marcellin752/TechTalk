import { sql, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { githubProfiles, users, type GithubLanguageShare, type GithubTopRepo } from '../db/schema.js';
import { config } from '../config/env.js';

const API = 'https://api.github.com';
const TOP_LANGUAGES = 6;
const TOP_REPOS = 8;

interface GhUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
}
interface GhRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

export interface GithubSummary {
  languages: GithubLanguageShare[];
  topRepos: GithubTopRepo[];
  totalStars: number;
}

/** Turns a list of repositories into what the profile shows. Forks and archived
 *  repos are ignored. Each repo votes for its language with a weight that grows
 *  (slowly) with its stars, so a popular project counts more than a scratch one
 *  without letting a single repo drown everything else. */
export function summarizeRepos(repos: GhRepo[]): GithubSummary {
  const own = repos.filter((r) => !r.fork && !r.archived);
  const weights = new Map<string, number>();
  for (const r of own) {
    if (!r.language) continue;
    weights.set(r.language, (weights.get(r.language) ?? 0) + 1 + Math.log10(1 + r.stargazers_count));
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  const languages = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LANGUAGES)
    .map(([name, w]) => ({ name, share: total ? Math.round((w / total) * 1000) / 1000 : 0 }));

  const topRepos = [...own]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, TOP_REPOS)
    .map((r) => ({
      name: r.name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      url: r.html_url,
      pushedAt: r.pushed_at,
    }));

  return { languages, topRepos, totalStars: own.reduce((n, r) => n + r.stargazers_count, 0) };
}

function headers(): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'TechTalk',
    ...(config.github.token ? { authorization: `Bearer ${config.github.token}` } : {}),
  };
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (res.status === 404) throw new Error('GitHub user not found');
  if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit reached, try again later');
  if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
  return (await res.json()) as T;
}

/** Public repositories only (the server token carries no private scope). */
export async function fetchGithubSnapshot(login: string) {
  const [user, repos] = await Promise.all([
    gh<GhUser>(`/users/${encodeURIComponent(login)}`),
    gh<GhRepo[]>(`/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed`),
  ]);
  return { user, ...summarizeRepos(repos) };
}

/** Resolves the handle from the numeric id when we only stored the id (older links). */
async function resolveLogin(userId: string): Promise<string | null> {
  const [u] = await db.select({ login: users.githubLogin, githubId: users.githubId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.githubId) return null;
  if (u.login) return u.login;
  const found = await gh<{ login: string }>(`/user/${u.githubId}`);
  await db.update(users).set({ githubLogin: found.login }).where(eq(users.id, userId));
  return found.login;
}

/** Fetches and stores the snapshot. Returns null when no GitHub account is linked. */
export async function syncGithubProfile(userId: string) {
  const login = await resolveLogin(userId);
  if (!login) return null;
  const snap = await fetchGithubSnapshot(login);
  const row = {
    userId,
    login: snap.user.login,
    name: snap.user.name,
    bio: snap.user.bio,
    avatarUrl: snap.user.avatar_url,
    htmlUrl: snap.user.html_url,
    publicRepos: snap.user.public_repos,
    followers: snap.user.followers,
    totalStars: snap.totalStars,
    languages: sql`${JSON.stringify(snap.languages)}::text::jsonb` as unknown as GithubLanguageShare[],
    topRepos: sql`${JSON.stringify(snap.topRepos)}::text::jsonb` as unknown as GithubTopRepo[],
    syncedAt: new Date(),
  };
  const { userId: _omit, ...update } = row;
  await db.insert(githubProfiles).values(row).onConflictDoUpdate({ target: githubProfiles.userId, set: update });
  const [saved] = await db.select().from(githubProfiles).where(eq(githubProfiles.userId, userId)).limit(1);
  return saved ?? null;
}

/** Fire-and-forget refresh after a sign-in or link; never blocks or fails the caller. */
export function syncGithubProfileInBackground(userId: string, login?: string | null): void {
  void (async () => {
    try {
      if (login) await db.update(users).set({ githubLogin: login }).where(eq(users.id, userId));
      await syncGithubProfile(userId);
    } catch (err) {
      console.warn('[GitHub profile] background sync failed:', (err as Error).message);
    }
  })();
}

import { sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { config } from '../../config/env.js';
import { markdownToHtml } from '../../utils/html.js';
import { classifyContent } from '../../utils/classify.js';

/* GitHub as a content source: well-maintained public repositories per topic,
   shown in the feed as learning material (the README is the article). Quality
   gates keep the feed clean: no forks, no archived repos, a minimum number of
   stars, recent activity and a README that actually exists. */

const API = 'https://api.github.com';
const ACTIVE_WITHIN_DAYS = 365;

export interface GithubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  pushed_at: string;
  default_branch: string;
  homepage?: string | null;
  fork: boolean;
  archived: boolean;
  owner: { login: string; avatar_url: string };
}

function headers(): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'TechTalk',
    'x-github-api-version': '2022-11-28',
    ...(config.github.token ? { authorization: `Bearer ${config.github.token}` } : {}),
  };
}

/** The search query for one topic, with every quality gate expressed server-side. */
export function buildSearchQuery(topic: string, minStars: number, now = new Date()): string {
  const since = new Date(now.getTime() - ACTIVE_WITHIN_DAYS * 86_400_000).toISOString().slice(0, 10);
  return `topic:${topic} stars:>=${minStars} fork:false archived:false pushed:>=${since}`;
}

/** Client-side re-check: a repo must still pass even if the API filter drifts. */
export function isWorthShowing(repo: GithubRepo, minStars: number): boolean {
  return (
    !repo.fork &&
    !repo.archived &&
    repo.stargazers_count >= minStars &&
    !!repo.description &&
    repo.description.trim().length >= 10
  );
}

/** README links are relative to the repo; make them work outside GitHub. */
export function absolutizeReadmeLinks(html: string, fullName: string, branch: string): string {
  const raw = `https://raw.githubusercontent.com/${fullName}/${branch}/`;
  const blob = `https://github.com/${fullName}/blob/${branch}/`;
  const isRelative = (u: string) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
  const clean = (u: string) => u.replace(/^\.?\//, '');
  return html
    .replace(/\bsrc="([^"]+)"/g, (m, u) => (isRelative(u) ? `src="${raw}${clean(u)}"` : m))
    .replace(/\bhref="([^"]+)"/g, (m, u) => (isRelative(u) ? `href="${blob}${clean(u)}"` : m));
}

async function fetchReadmeHtml(repo: GithubRepo): Promise<string | null> {
  const res = await fetch(`${API}/repos/${repo.full_name}/readme`, {
    headers: { ...headers(), accept: 'application/vnd.github.raw+json' },
  });
  if (!res.ok) return null;
  const markdown = (await res.text()).slice(0, 200_000);
  if (markdown.trim().length < 200) return null; // a stub README teaches nothing
  return absolutizeReadmeLinks(markdownToHtml(markdown), repo.full_name, repo.default_branch);
}

export function toContentRow(repo: GithubRepo, body: string) {
  const description = repo.description!.trim();
  return {
    title: repo.full_name.slice(0, 255),
    url: repo.html_url,
    source: 'GitHub',
    type: 'repo',
    summary: description,
    body,
    categories: classifyContent(`${repo.full_name} ${repo.language ?? ''} ${(repo.topics ?? []).join(' ')}`, description),
    // GitHub renders a social preview card for any public repository.
    image: `https://opengraph.githubassets.com/1/${repo.full_name}`,
    embedCode: null,
    meta: {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      language: repo.language,
      topics: repo.topics ?? [],
      license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : null,
      pushedAt: repo.pushed_at,
      owner: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
      homepage: repo.homepage || null,
    },
  };
}

async function searchTopic(topic: string): Promise<GithubRepo[]> {
  const params = new URLSearchParams({
    q: buildSearchQuery(topic, config.github.minStars),
    sort: 'stars',
    order: 'desc',
    per_page: String(Math.min(config.github.maxPerTopic * 2, 50)), // headroom for repos we filter out
  });
  const res = await fetch(`${API}/search/repositories?${params}`, { headers: headers() });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit reached');
  if (!res.ok) throw new Error(`GitHub search for "${topic}" failed with status ${res.status}`);
  const data = (await res.json()) as { items?: GithubRepo[] };
  return (data.items ?? []).filter((r) => isWorthShowing(r, config.github.minStars)).slice(0, config.github.maxPerTopic);
}

/**
 * Fetches trending, maintained repositories for each configured topic and
 * upserts them. Existing rows get fresh stats so the feed never shows stale numbers.
 */
export async function fetchLiveGithubRepos(): Promise<void> {
  if (!config.github.token) {
    console.warn('[Automation Worker] GITHUB_TOKEN is not set — skipping the GitHub provider.');
    return;
  }
  console.log('[Automation Worker] Fetching repositories from GitHub...');
  let inserted = 0;
  let refreshed = 0;

  for (const topic of config.github.topics) {
    try {
      for (const repo of await searchTopic(topic)) {
        const body = await fetchReadmeHtml(repo);
        if (!body) continue;
        const row = toContentRow(repo, body);
        // Explicit ::text::jsonb cast (a bare ::jsonb makes postgres-js encode the string again): drizzle 0.30 + postgres-js would store the object as a JSON string.
        const meta = sql`${JSON.stringify(row.meta)}::text::jsonb`;
        const result = await db
          .insert(contents)
          .values({ ...row, meta })
          .onConflictDoUpdate({ target: contents.url, set: { meta, summary: row.summary, body: row.body } })
          .returning({ createdAt: contents.createdAt });
        // A row created within the last minute is a genuine insert.
        if (result[0] && Date.now() - new Date(result[0].createdAt).getTime() < 60_000) inserted++;
        else refreshed++;
      }
    } catch (err) {
      console.error(`[Automation Worker] GitHub topic "${topic}" failed:`, err);
      if (err instanceof Error && err.message.includes('rate limit')) break;
    }
  }
  console.log(`[Automation Worker] GitHub: ${inserted} new, ${refreshed} refreshed.`);
}

import { sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { contents } from '../../db/schema.js';
import { config } from '../../config/env.js';
import { classifyContent } from '../../utils/classify.js';

/* Opportunities shown as full-width bands inside the feed:
   - remote jobs from Remotive (public API; its terms ask us to credit Remotive,
     link back to the job and not poll more than a few times a day);
   - "good first issue" tickets in the high-star projects the feed already shows,
     so learning ("read this project") leads straight to doing ("fix this issue"). */

const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastRun = 0;

const DEV_CATEGORY = /software|dev|engineer|data|ai\b|artificial|machine|security|qa/i;

export interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string | null;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export interface GithubIssue {
  html_url: string;
  title: string;
  body?: string | null;
  comments: number;
  labels?: Array<{ name?: string } | string>;
  repository_url: string; // https://api.github.com/repos/owner/name
  created_at: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Markdown/plain issue bodies, shortened for a two-line teaser. */
export function teaser(text: string | null | undefined, max = 220): string {
  const plain = stripHtml(String(text ?? ''))
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

export function jobToRow(job: RemotiveJob) {
  const description = teaser(job.description);
  return {
    title: `${job.title}`.slice(0, 255),
    url: job.url,
    source: 'Remotive',
    type: 'opportunity',
    summary: description || `${job.title} at ${job.company_name}.`,
    body: null,
    categories: classifyContent(job.title, `${job.category ?? ''} ${(job.tags ?? []).join(' ')}`),
    image: job.company_logo || null,
    embedCode: null,
    meta: {
      kind: 'job',
      company: job.company_name,
      location: job.candidate_required_location || 'Remote',
      salary: job.salary || null,
      jobType: job.job_type || null,
      tags: (job.tags ?? []).slice(0, 4),
    },
  };
}

export function issueToRow(issue: GithubIssue, avatarUrl: string | null) {
  const repo = issue.repository_url.replace('https://api.github.com/repos/', '');
  const labels = (issue.labels ?? [])
    .map((l) => (typeof l === 'string' ? l : l.name ?? ''))
    .filter((l) => l && l.toLowerCase() !== 'good first issue')
    .slice(0, 3);
  return {
    title: issue.title.slice(0, 255),
    url: issue.html_url,
    source: 'GitHub',
    type: 'opportunity',
    summary: teaser(issue.body) || `A beginner-friendly issue in ${repo}.`,
    body: null,
    categories: classifyContent(issue.title, repo),
    image: avatarUrl,
    embedCode: null,
    meta: { kind: 'issue', repo, labels, comments: issue.comments },
  };
}

// Same ::text::jsonb cast the GitHub provider uses (drizzle 0.30 + postgres-js double-encode jsonb).
const asJsonb = (value: unknown) => sql`${JSON.stringify(value)}::text::jsonb`;

async function save(row: ReturnType<typeof jobToRow> | ReturnType<typeof issueToRow>): Promise<void> {
  const meta = asJsonb(row.meta);
  await db
    .insert(contents)
    .values({ ...row, meta })
    .onConflictDoUpdate({ target: contents.url, set: { meta, summary: row.summary, image: row.image } });
}

async function fetchJobs(): Promise<number> {
  const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=30', {
    headers: { 'user-agent': 'TechTalk' },
  });
  if (!res.ok) throw new Error(`Remotive responded with ${res.status}`);
  const data = (await res.json()) as { jobs?: RemotiveJob[] };
  const jobs = (data.jobs ?? []).filter((j) => j.url && DEV_CATEGORY.test(`${j.category ?? ''} ${j.title}`));
  for (const job of jobs) await save(jobToRow(job));
  return jobs.length;
}

async function fetchIssues(): Promise<number> {
  if (!config.github.token) return 0;
  // The most popular projects already in the feed, with their avatars.
  const repos = (await db.execute(sql`
    select title, meta->>'avatarUrl' as avatar from contents
    where type = 'repo' and meta is not null
    order by (meta->>'stars')::int desc nulls last limit 40
  `)) as unknown as Array<{ title: string; avatar: string | null }>;
  const avatars = new Map(repos.map((r) => [r.title.toLowerCase(), r.avatar]));
  const names = repos.map((r) => r.title);
  let saved = 0;

  for (let i = 0; i < names.length; i += 4) {
    const q = `label:"good first issue" is:issue is:open no:assignee ${names.slice(i, i + 4).map((n) => `repo:${n}`).join(' ')}`;
    const params = new URLSearchParams({ q, sort: 'created', order: 'desc', per_page: '6' });
    const res = await fetch(`https://api.github.com/search/issues?${params}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'TechTalk',
        authorization: `Bearer ${config.github.token}`,
      },
    });
    if (res.status === 403 || res.status === 429) break; // rate limited: keep what we have
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: GithubIssue[] };
    for (const issue of data.items ?? []) {
      const repo = issue.repository_url.replace('https://api.github.com/repos/', '').toLowerCase();
      await save(issueToRow(issue, avatars.get(repo) ?? null));
      saved++;
    }
  }
  return saved;
}

/** Throttled: external terms and rate limits make hourly polling unwelcome. */
export async function fetchLiveOpportunities(force = false): Promise<void> {
  if (!force && Date.now() - lastRun < MIN_INTERVAL_MS) return;
  lastRun = Date.now();
  console.log('[Automation Worker] Fetching opportunities (Remotive jobs, good first issues)...');
  const [jobs, issues] = await Promise.allSettled([fetchJobs(), fetchIssues()]);
  const count = (r: PromiseSettledResult<number>) => (r.status === 'fulfilled' ? r.value : `failed (${(r.reason as Error).message})`);
  console.log(`[Automation Worker] Opportunities: jobs ${count(jobs)}, issues ${count(issues)}.`);
}

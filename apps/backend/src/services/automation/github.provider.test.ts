import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config/env.js', () => ({
  config: { github: { token: 't', topics: ['typescript'], minStars: 100, maxPerTopic: 2 } },
}));

const inserted = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('../../db/db.js', () => ({
  db: {
    insert: () => ({
      values: (row: any) => ({
        onConflictDoUpdate: () => ({
          returning: async () => (inserted.rows.push(row), [{ createdAt: new Date() }]),
        }),
      }),
    }),
  },
}));

import {
  absolutizeReadmeLinks,
  buildSearchQuery,
  fetchLiveGithubRepos,
  isWorthShowing,
  toContentRow,
  type GithubRepo,
} from './github.provider.js';

const repo = (over: Partial<GithubRepo> = {}): GithubRepo => ({
  full_name: 'acme/widgets',
  html_url: 'https://github.com/acme/widgets',
  description: 'A well documented widget toolkit',
  stargazers_count: 4200,
  forks_count: 300,
  open_issues_count: 12,
  language: 'TypeScript',
  topics: ['typescript', 'ui'],
  license: { spdx_id: 'MIT' },
  pushed_at: '2026-10-30T10:00:00Z',
  default_branch: 'main',
  fork: false,
  archived: false,
  owner: { login: 'acme', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  ...over,
});

describe('quality gates', () => {
  it('builds a query that excludes forks and archived repos and requires recent activity', () => {
    const q = buildSearchQuery('react', 250, new Date('2026-11-06T00:00:00Z'));
    expect(q).toBe('topic:react stars:>=250 fork:false archived:false pushed:>=2025-11-06');
  });

  it('rejects forks, archived, low stars and empty descriptions', () => {
    expect(isWorthShowing(repo(), 100)).toBe(true);
    expect(isWorthShowing(repo({ fork: true }), 100)).toBe(false);
    expect(isWorthShowing(repo({ archived: true }), 100)).toBe(false);
    expect(isWorthShowing(repo({ stargazers_count: 99 }), 100)).toBe(false);
    expect(isWorthShowing(repo({ description: null }), 100)).toBe(false);
    expect(isWorthShowing(repo({ description: 'tiny' }), 100)).toBe(false);
  });
});

describe('README links', () => {
  it('makes relative images and links absolute and leaves absolute ones alone', () => {
    const html = '<img src="docs/logo.png"><a href="./CONTRIBUTING.md">c</a><a href="https://x.dev">x</a><a href="#usage">u</a>';
    const out = absolutizeReadmeLinks(html, 'acme/widgets', 'main');
    expect(out).toContain('src="https://raw.githubusercontent.com/acme/widgets/main/docs/logo.png"');
    expect(out).toContain('href="https://github.com/acme/widgets/blob/main/CONTRIBUTING.md"');
    expect(out).toContain('href="https://x.dev"');
    expect(out).toContain('href="#usage"');
  });
});

describe('row mapping', () => {
  it('maps a repo to a content row with meta and a social preview image', () => {
    const row = toContentRow(repo(), '<p>readme</p>');
    expect(row).toMatchObject({ title: 'acme/widgets', source: 'GitHub', type: 'repo', url: 'https://github.com/acme/widgets' });
    expect(row.image).toBe('https://opengraph.githubassets.com/1/acme/widgets');
    expect(row.meta).toMatchObject({ stars: 4200, language: 'TypeScript', license: 'MIT', owner: 'acme' });
  });

  it('drops an unknown license marker', () => {
    expect(toContentRow(repo({ license: { spdx_id: 'NOASSERTION' } }), 'x').meta.license).toBeNull();
  });
});

describe('fetchLiveGithubRepos', () => {
  const longReadme = '# Widgets\n\n' + 'Lots of useful documentation. '.repeat(20);
  beforeEach(() => {
    inserted.rows = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores repos that pass the gates and have a real README, and skips the rest', async () => {
    const good = repo();
    const stub = repo({ full_name: 'acme/stub', html_url: 'https://github.com/acme/stub' });
    const forked = repo({ full_name: 'acme/forked', html_url: 'https://github.com/acme/forked', fork: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/search/repositories')) return new Response(JSON.stringify({ items: [good, forked, stub] }), { status: 200 });
        if (url.includes('/acme/stub/readme')) return new Response('# tiny', { status: 200 });
        if (url.includes('/readme')) return new Response(longReadme, { status: 200 });
        return new Response('', { status: 404 });
      }),
    );
    await fetchLiveGithubRepos();
    expect(inserted.rows.map((r) => r.title)).toEqual(['acme/widgets']);
    expect(inserted.rows[0].body).toContain('Lots of useful documentation');
  });

  it('stops after a rate limit instead of hammering the API', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchLiveGithubRepos();
    expect(inserted.rows).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

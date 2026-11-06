import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/env.js', () => ({ config: { github: { token: 't' } } }));
vi.mock('../db/db.js', () => ({ db: {} }));

import { summarizeRepos } from './github-profile.js';

const repo = (over: Record<string, unknown> = {}) => ({
  name: 'r',
  description: 'd',
  stargazers_count: 0,
  forks_count: 0,
  language: 'TypeScript',
  html_url: 'https://github.com/u/r',
  pushed_at: '2026-10-01T00:00:00Z',
  fork: false,
  archived: false,
  ...over,
});

describe('summarizeRepos', () => {
  it('ignores forks and archived repositories', () => {
    const out = summarizeRepos([repo({ name: 'mine' }), repo({ name: 'f', fork: true }), repo({ name: 'a', archived: true })] as any);
    expect(out.topRepos.map((r) => r.name)).toEqual(['mine']);
  });

  it('computes language shares that sum to ~1, weighting popular repos more', () => {
    const out = summarizeRepos([
      repo({ name: 'a', language: 'Rust', stargazers_count: 5000 }),
      repo({ name: 'b', language: 'Python', stargazers_count: 0 }),
      repo({ name: 'c', language: 'Python', stargazers_count: 0 }),
      repo({ name: 'd', language: null }),
    ] as any);
    const total = out.languages.reduce((n, l) => n + l.share, 0);
    expect(total).toBeGreaterThan(0.99);
    expect(total).toBeLessThan(1.01);
    // One starred Rust repo outweighs two unstarred Python ones.
    expect(out.languages[0].name).toBe('Rust');
    expect(out.languages.map((l) => l.name)).not.toContain('null');
  });

  it('lists top repos by stars and totals them', () => {
    const out = summarizeRepos([repo({ name: 'low', stargazers_count: 2 }), repo({ name: 'high', stargazers_count: 90 })] as any);
    expect(out.topRepos[0].name).toBe('high');
    expect(out.totalStars).toBe(92);
  });

  it('caps the lists', () => {
    const many = Array.from({ length: 30 }, (_, i) => repo({ name: `r${i}`, language: `L${i}`, stargazers_count: i }));
    const out = summarizeRepos(many as any);
    expect(out.topRepos).toHaveLength(8);
    expect(out.languages).toHaveLength(6);
  });
});

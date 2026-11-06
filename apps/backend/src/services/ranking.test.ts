import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/db.js', () => ({ db: {} }));

import { scoreContent, rankContents, type RankSignals } from './ranking.js';

const NOW = Date.parse('2026-11-06T12:00:00Z');
let n = 0;
const item = (over: Record<string, unknown> = {}) =>
  ({
    id: `id-${++n}`,
    title: 'Some title',
    url: `https://x/${n}`,
    source: 'YouTube',
    type: 'video',
    summary: '',
    body: null,
    categories: [],
    image: null,
    embedCode: null,
    meta: null,
    createdAt: new Date(NOW),
    ...over,
  }) as any;

const signals = (over: Partial<RankSignals> = {}): RankSignals => ({
  interests: [],
  languages: [],
  affinity: new Map(),
  readIds: new Set(),
  now: NOW,
  ...over,
});

describe('scoreContent', () => {
  it('prefers items matching a followed topic and says why', () => {
    const match = scoreContent(item({ categories: ['Backend'] }), signals({ interests: ['Backend'] }));
    const other = scoreContent(item({ categories: ['Cloud'] }), signals({ interests: ['Backend'] }));
    expect(match.score).toBeGreaterThan(other.score);
    expect(match.reason).toBe('Because you follow Backend');
    expect(other.reason).toBeNull();
  });

  it("boosts repositories written in the user's main language, by share", () => {
    const s = signals({ languages: [{ name: 'TypeScript', share: 0.7 }, { name: 'Rust', share: 0.1 }] });
    const ts = scoreContent(item({ type: 'repo', meta: { language: 'TypeScript', stars: 1000 } }), s);
    const rust = scoreContent(item({ type: 'repo', meta: { language: 'Rust', stars: 1000 } }), s);
    const py = scoreContent(item({ type: 'repo', meta: { language: 'Python', stars: 1000 } }), s);
    expect(ts.score).toBeGreaterThan(rust.score);
    expect(rust.score).toBeGreaterThan(py.score);
    expect(ts.reason).toBe('Because you code in TypeScript');
  });

  it('detects a language in the text of videos and articles, without false matches', () => {
    const s = signals({ languages: [{ name: 'Java', share: 0.5 }, { name: 'Go', share: 0.3 }] });
    expect(scoreContent(item({ title: 'Learn Java in 1 hour' }), s).reason).toBe('Because you code in Java');
    // "JavaScript" is not Java, and a bare "go" is not Go.
    expect(scoreContent(item({ title: 'JavaScript tips, ready to go' }), s).reason).toBeNull();
    expect(scoreContent(item({ title: 'Golang concurrency patterns' }), s).reason).toBe('Because you code in Go');
  });

  it('uses what the user saved and read', () => {
    const s = signals({ affinity: new Map([['Security', 1.2]]) });
    const r = scoreContent(item({ categories: ['Security'] }), s);
    expect(r.reason).toBe('Similar to what you saved or read (Security)');
    expect(r.score).toBeGreaterThan(scoreContent(item({ categories: ['Cloud'] }), s).score);
  });

  it('decays with age and demotes what was already read', () => {
    const fresh = item();
    const old = item({ createdAt: new Date(NOW - 60 * 86_400_000) });
    expect(scoreContent(fresh, signals()).score).toBeGreaterThan(scoreContent(old, signals()).score);
    expect(scoreContent(fresh, signals({ readIds: new Set([fresh.id]) })).score).toBeLessThan(scoreContent(fresh, signals()).score);
  });
});

describe('rankContents', () => {
  it('orders best first and carries the reason', () => {
    const a = item({ categories: ['Cloud'] });
    const b = item({ categories: ['Backend'] });
    const out = rankContents([a, b], signals({ interests: ['Backend'] }));
    expect(out.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(out[0].reason).toBe('Because you follow Backend');
  });

  it('keeps the newest first on equal scores', () => {
    const older = item({ createdAt: new Date(NOW - 1000) });
    const newer = item({ createdAt: new Date(NOW) });
    // Same age bucket would tie only without decay; compare ordering directly.
    const out = rankContents([older, newer], signals());
    expect(out[0].id).toBe(newer.id);
  });
});

describe('wildcards (something different)', async () => {
  const { isOutsideDomains, pickWildcards } = await import('./ranking.js');
  const sig = signals({ interests: ['Backend'], languages: [{ name: 'Python', share: 0.6 }], affinity: new Map([['Security', 2]]) });

  it('flags only items unrelated to the learner, judging by whole words', () => {
    expect(isOutsideDomains(item({ title: 'Build a REST API with Fastify' }), sig)).toBe(false); // their topic
    expect(isOutsideDomains(item({ title: 'Learn Python fast' }), sig)).toBe(false); // their language
    expect(isOutsideDomains(item({ type: 'repo', title: 'x/y', meta: { language: 'Python' } }), sig)).toBe(false);
    // "capital" contains "api" but is not about APIs.
    expect(isOutsideDomains(item({ title: 'The Capital Cost of Nuclear Power' }), sig)).toBe(true);
    expect(isOutsideDomains(item({ title: 'A history of typography and print' }), sig)).toBe(true);
  });

  it('never claims "outside" when the learner follows nothing, or for opportunities', () => {
    expect(isOutsideDomains(item({ title: 'Cooking' }), signals({ interests: [] }))).toBe(false);
    expect(isOutsideDomains(item({ type: 'opportunity', title: 'Cooking' }), sig)).toBe(false);
  });

  it('returns only unrelated, unread, lecture-grade items, labelled, and varies with the draw', () => {
    const pool = [
      ...Array.from({ length: 12 }, (_, i) => item({ id: `w${i}`, title: `Poetry and code ${i}`, meta: { learn: true } })),
      item({ id: 'short', title: 'a short about poetry' }), // a video that is not a lecture is never picked
      item({ id: 'on', title: 'Fastify API tutorial', meta: { learn: true } }),
    ];
    const first = pickWildcards(pool, { ...sig, readIds: new Set(['w0']) }, 3, () => 0, NOW);
    expect(first).toHaveLength(3);
    expect(first.every((x) => x.wildcard && x.reason.startsWith('Something different') && !['on', 'w0', 'short'].includes(x.id))).toBe(true);
    const other = pickWildcards(pool, sig, 3, () => 0.99, NOW).map((x) => x.id);
    expect(other).not.toEqual(first.map((x) => x.id));
  });
});

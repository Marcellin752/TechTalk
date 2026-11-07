import { describe, expect, it } from 'vitest';
import { schedule } from './sm2.js';
import { risingTopics } from './trends.js';
import { matchMentors, canTeach } from './mentors.js';
import { nextActions } from './actions.js';

const base = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
const now = new Date('2026-01-10T10:00:00Z');
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);

describe('sm2', () => {
  it('grows the interval on repeated good answers', () => {
    let s = schedule(base, 2, now);
    expect(days(s.dueAt)).toBe(1);
    s = schedule(s, 2, now);
    expect(days(s.dueAt)).toBe(6);
    s = schedule(s, 2, now);
    expect(days(s.dueAt)).toBeGreaterThanOrEqual(14);
  });
  it('forgetting resets reps, counts a lapse, lowers ease but never below the floor', () => {
    let s = { ...base, ease: 1.35, reps: 5, intervalDays: 30 };
    s = schedule(s, 0, now);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.ease).toBe(1.3);
    expect(s.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });
  it('easy is longer than hard', () => {
    const s = { ease: 2.5, intervalDays: 6, reps: 2, lapses: 0 };
    expect(schedule(s, 3, now).intervalDays).toBeGreaterThan(schedule(s, 1, now).intervalDays);
  });
  it('the interval is never zero after a pass', () => {
    expect(schedule({ ...base, ease: 1.3 }, 1, now).intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe('trends', () => {
  const at = (d: number) => new Date(now.getTime() - d * 86_400_000);
  it('ranks by change in share, ignores tiny topics', () => {
    const rows = [
      ...Array.from({ length: 6 }, () => ({ categories: ['rust'], createdAt: at(5) })),
      ...Array.from({ length: 2 }, () => ({ categories: ['rust'], createdAt: at(40) })),
      ...Array.from({ length: 6 }, () => ({ categories: ['java'], createdAt: at(5) })),
      ...Array.from({ length: 12 }, () => ({ categories: ['java'], createdAt: at(40) })),
      { categories: ['tiny'], createdAt: at(1) },
    ];
    const t = risingTopics(rows, now);
    expect(t.map((x) => x.topic)).not.toContain('tiny');
    expect(t[0]!.topic).toBe('rust');
    expect(t.find((x) => x.topic === 'java')!.change).toBeLessThan(t[0]!.change);
  });
  it('ignores future and very old rows', () => {
    expect(risingTopics([{ categories: ['x'], createdAt: new Date(now.getTime() + 1e6) }, { categories: ['x'], createdAt: at(400) }], now, 30, 1)).toEqual([]);
  });
});

describe('mentors', () => {
  it('only offers mentors with shown understanding of the topic', () => {
    const r = matchMentors('c', [
      { userId: 'a', offering: ['c'], levels: { c: 'learning' } },
      { userId: 'b', offering: ['c'], levels: { c: 'understood' } },
      { userId: 'c', offering: ['c'], levels: { c: 'applied' } },
      { userId: 'me', offering: ['c'], levels: { c: 'applied' } },
      { userId: 'd', offering: ['rust'], levels: { c: 'applied' } },
    ], 'me');
    expect(r.map((x) => x.userId)).toEqual(['c', 'b']);
    expect(canTeach('exploring')).toBe(false);
  });
});

describe('next actions', () => {
  const ctx = { dueReviews: 0, dueCards: 0, nextStep: null, deadline: null, weak: [], ready: [], streak: 0, doneToday: 0 };
  it('is empty when there is nothing to do', () => expect(nextActions(ctx)).toEqual([]));
  it('puts a close deadline first and caps the list', () => {
    const r = nextActions({ ...ctx, deadline: { title: 'Project', inDays: 2 }, dueReviews: 3, nextStep: { title: 'S', pathId: 'p' }, weak: [{ slug: 'c', name: 'C' }], ready: [{ slug: 'x', name: 'X' }], streak: 3 });
    expect(r[0]!.kind).toBe('deadline');
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r.every((a) => a.reason.length > 0)).toBe(true);
  });
  it('ignores a far deadline', () => expect(nextActions({ ...ctx, deadline: { title: 'P', inDays: 30 } })).toEqual([]));
});

import { EXERCISES } from './exercises.js';
import { ONTOLOGY } from '../skills/ontology.js';

describe('exercises', () => {
  it('have unique ids, point at real concepts and have tests', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    const slugs = new Set(ONTOLOGY.map((c) => c.slug));
    for (const e of EXERCISES) {
      expect(slugs.has(e.concept), e.concept).toBe(true);
      expect(e.tests.length).toBeGreaterThanOrEqual(3);
      expect(e.starter).toContain(`function ${e.fn}(`);
    }
  });
});

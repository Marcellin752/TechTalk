import { describe, it, expect, vi } from 'vitest';
import { aggregateCohort, extractApiKey, generateApiKey, hashApiKey, MIN_COHORT, parseCurriculum, parseSchoolEvent, presetCurriculum, slugify, type LearnerRow } from './schools.js';
import { scoreItem, type CatalogItem, type LearnerProfile } from './learning/generator.js';

vi.mock('../db/db.js', () => ({ db: {} }));

describe('API keys', () => {
  it('generates a prefixed key whose hash matches and which differs every time', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key.startsWith('ttk_')).toBe(true);
    expect(a.key.length).toBeGreaterThan(40);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toContain(a.key);
  });

  it('reads the key from X-API-Key or a Bearer header, and ignores anything else', () => {
    expect(extractApiKey({ 'x-api-key': 'ttk_abc' })).toBe('ttk_abc');
    expect(extractApiKey({ authorization: 'Bearer ttk_abc' })).toBe('ttk_abc');
    expect(extractApiKey({ authorization: 'Bearer eyJhbGciOi.user.jwt' })).toBeNull(); // a user token is not a school key
    expect(extractApiKey({ 'x-api-key': 'nope' })).toBeNull();
    expect(extractApiKey({})).toBeNull();
  });
});

describe('slugs and presets', () => {
  it('makes safe slugs', () => {
    expect(slugify('Epitech')).toBe('epitech');
    expect(slugify("École Polytechnique d'Été!")).toBe('ecole-polytechnique-d-ete');
    expect(slugify('***')).toBe('');
  });
  it('has Epitech built in', () => {
    expect(presetCurriculum('epitech')!.years[0]).toContain('c');
    expect(presetCurriculum('nope')).toBeNull();
  });
});

describe('parseCurriculum', () => {
  it('cleans the topics of each year', () => {
    const r = parseCurriculum({ years: [['C', ' Unix ', 'c'], ['Web', '<b>']] });
    expect(r.ok && r.curriculum.years).toEqual([['c', 'unix'], ['web']]);
  });
  it('rejects empty, too long or malformed input', () => {
    expect(parseCurriculum({}).ok).toBe(false);
    expect(parseCurriculum({ years: [] }).ok).toBe(false);
    expect(parseCurriculum({ years: [[], []] }).ok).toBe(false);
    expect(parseCurriculum({ years: Array.from({ length: 9 }, () => ['c']) }).ok).toBe(false);
    expect(parseCurriculum(null).ok).toBe(false);
  });
});

describe('parseSchoolEvent', () => {
  const ok = { externalId: 'exam-c-2030', title: ' Exam C ', kind: 'school', startsAt: '2030-01-08T09:00:00Z', endsAt: '2030-01-08T12:00:00Z', year: 1 };
  it('accepts a good event', () => {
    const r = parseSchoolEvent(ok);
    expect(r.ok && r.event.title).toBe('Exam C');
    expect(r.ok && r.event.year).toBe(1);
  });
  it('rejects bad ones with a reason', () => {
    expect(parseSchoolEvent({ ...ok, externalId: 'bad id!' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, title: '' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, kind: 'party' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, startsAt: 'x' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, endsAt: '2030-01-08T08:00:00Z' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, endsAt: '2030-03-08T08:00:00Z' }).ok).toBe(false);
    expect(parseSchoolEvent({ ...ok, year: 12 }).ok).toBe(false);
    expect(parseSchoolEvent(null).ok).toBe(false);
  });
  it('lets the year be omitted (every year)', () => {
    const { year: _y, ...rest } = ok;
    const r = parseSchoolEvent(rest);
    expect(r.ok && r.event.year).toBeNull();
  });
});

describe('aggregateCohort (privacy)', () => {
  const learner = (year: number, percent: number, goal = 'backend', level = 'basics'): LearnerRow => ({ year, goal, level, percent });

  it('says nothing but the fact when fewer than the minimum agreed to share', () => {
    const few = Array.from({ length: MIN_COHORT - 1 }, (_, i) => learner(1, 10 * i));
    expect(aggregateCohort(few)).toEqual({ learners: null, suppressed: true, minimumGroupSize: MIN_COHORT });
  });

  it('reports totals once the minimum is reached', () => {
    const rows = Array.from({ length: 6 }, (_, i) => learner(1, 10 * (i + 1)));
    const r = aggregateCohort(rows);
    expect(r.suppressed).toBe(false);
    expect(r.learners).toBe(6);
    expect(r.averageProgressPercent).toBe(35);
  });

  it('drops any breakdown group smaller than the minimum, so one person cannot be singled out', () => {
    const rows = [...Array.from({ length: 6 }, () => learner(1, 20)), learner(2, 99, 'security', 'advanced'), learner(2, 98, 'security', 'advanced')];
    const r = aggregateCohort(rows) as { byYear: { year: number }[]; goals: { goal: string }[]; levels: { level: string }[] };
    expect(r.byYear.map((y) => y.year)).toEqual([1]); // year 2 has 2 learners: hidden
    expect(r.goals.map((g) => g.goal)).toEqual(['backend']);
    expect(r.levels.map((l) => l.level)).toEqual(['basics']);
    expect(JSON.stringify(r)).not.toContain('99');
  });
});

describe('crowd signal in recommendations', () => {
  const profile: LearnerProfile = { goal: 'backend', level: 'basics', languages: ['Python'], hoursPerWeek: 6, style: 'mixed' };
  const slot = { type: 'video' as const, terms: ['python'], count: 1 };
  const video = (signal: CatalogItem['signal']): CatalogItem => ({ id: 'v', type: 'video', title: 'Python course', summary: '', source: 't', categories: [], meta: { durationSeconds: 3000 }, signal });

  it('ranks what most sharing learners finish above what most drop', () => {
    const finished = scoreItem(video({ done: 18, started: 20 }), slot, profile, ['Python'], []);
    const none = scoreItem(video(null), slot, profile, ['Python'], []);
    const dropped = scoreItem(video({ done: 2, started: 20 }), slot, profile, ['Python'], []);
    expect(finished).toBeGreaterThan(none);
    expect(dropped).toBeLessThan(none);
  });

  it('ignores a signal that rests on too few learners', () => {
    const base = scoreItem(video(null), slot, profile, ['Python'], []);
    expect(scoreItem(video({ done: 0, started: 4 }), slot, profile, ['Python'], [])).toBe(base);
  });

  it('never lets the signal bring in an off-topic resource', () => {
    const offTopic: CatalogItem = { ...video({ done: 20, started: 20 }), title: 'Cooking pasta' };
    expect(scoreItem(offTopic, slot, profile, ['Python'], [])).toBe(0);
  });
});

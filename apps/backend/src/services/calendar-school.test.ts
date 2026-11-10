import { describe, it, expect, vi } from 'vitest';
import { buildIcs, planSessions, type PlanStep } from './calendar.js';
import { cleanTopics, schoolStage, SCHOOL_PRESETS } from './learning/school.js';
import { generatePath, scoreItem, type CatalogItem, type LearnerProfile } from './learning/generator.js';
import { parseEvent } from '../controllers/calendar.controller.js';
import { parseProfile } from '../controllers/learning.controller.js';

vi.mock('../db/db.js', () => ({ db: {} }));

const steps = (n: number, minutes = 40): PlanStep[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, contentId: `c${i}`, title: `Step ${i}`, minutes }));

// Monday 2030-01-07 10:00 UTC
const monday = new Date('2030-01-07T10:00:00Z');

describe('planSessions', () => {
  it('starts tomorrow, on the chosen days, at the chosen hour', () => {
    const out = planSessions(steps(4), { weeklyMinutes: 240, startHour: 18, tzOffset: 0, days: [2, 4], weeks: 2, from: monday });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.startsAt.toISOString()).toBe('2030-01-08T18:00:00.000Z'); // Tuesday
    for (const s of out) expect([2, 4]).toContain(s.startsAt.getUTCDay());
  });

  it('never exceeds the weekly time', () => {
    const out = planSessions(steps(30), { weeklyMinutes: 180, startHour: 9, tzOffset: 0, days: [1, 2, 3, 4, 5], weeks: 1, from: monday });
    const total = out.reduce((n, s) => n + (s.endsAt.getTime() - s.startsAt.getTime()) / 60000, 0);
    expect(total).toBeLessThanOrEqual(180);
  });

  it('keeps sessions in order and splits a long step across days', () => {
    const out = planSessions([{ id: 'big', contentId: 'c', title: 'Long course', minutes: 300 }], { weeklyMinutes: 600, startHour: 9, tzOffset: 0, days: [1, 2, 3, 4, 5], weeks: 2, from: monday });
    expect(out.length).toBeGreaterThan(2);
    expect(out.every((s) => s.stepId === 'big')).toBe(true);
    expect(out.every((s) => (s.endsAt.getTime() - s.startsAt.getTime()) / 60000 <= 90)).toBe(true);
    for (let i = 1; i < out.length; i++) expect(out[i]!.startsAt.getTime()).toBeGreaterThan(out[i - 1]!.startsAt.getTime());
  });

  it('honours the learner time zone', () => {
    // Paris in winter: getTimezoneOffset() = -60, so 18:00 local is 17:00 UTC.
    const out = planSessions(steps(1), { weeklyMinutes: 120, startHour: 18, tzOffset: -60, days: [2], weeks: 1, from: monday });
    expect(out[0]!.startsAt.toISOString()).toBe('2030-01-08T17:00:00.000Z');
  });

  it('plans nothing without steps, days or time', () => {
    const base = { startHour: 18, tzOffset: 0, weeks: 2, from: monday };
    expect(planSessions([], { ...base, weeklyMinutes: 300, days: [1] })).toEqual([]);
    expect(planSessions(steps(2), { ...base, weeklyMinutes: 300, days: [] })).toEqual([]);
    expect(planSessions(steps(2), { ...base, weeklyMinutes: 5, days: [1] })).toEqual([]);
  });
});

describe('buildIcs', () => {
  it('writes a valid calendar and escapes text', () => {
    const ics = buildIcs([{ id: 'e1', title: 'Exam; C, part 1', kind: 'school', startsAt: new Date('2030-01-08T09:00:00Z'), endsAt: new Date('2030-01-08T11:00:00Z'), notes: 'Bring\nID' }], new Date('2030-01-01T00:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20300108T090000Z');
    expect(ics).toContain('SUMMARY:Exam\; C\\, part 1');
    expect(ics).toContain('DESCRIPTION:Bring\\nID');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines at 75 octets', () => {
    const ics = buildIcs([{ id: 'e', title: 'x'.repeat(200), kind: 'event', startsAt: monday, endsAt: monday, notes: null }]);
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});

describe('parseEvent', () => {
  const ok = { title: ' Exam ', kind: 'school', startsAt: '2030-01-08T09:00:00Z', endsAt: '2030-01-08T11:00:00Z' };
  it('accepts a good event and trims it', () => {
    const r = parseEvent(ok, false);
    expect(r.ok && r.values.title).toBe('Exam');
  });
  it('rejects bad input', () => {
    expect(parseEvent({ ...ok, title: '  ' }, false).ok).toBe(false);
    expect(parseEvent({ ...ok, kind: 'party' }, false).ok).toBe(false);
    expect(parseEvent({ ...ok, startsAt: 'nope' }, false).ok).toBe(false);
    expect(parseEvent({ ...ok, notes: 'x'.repeat(501) }, false).ok).toBe(false);
  });
  it('allows partial updates', () => {
    expect(parseEvent({ done: true }, true)).toEqual({ ok: true, values: { done: true } });
    expect(parseEvent({ done: 'yes' }, true).ok).toBe(false);
  });
});

describe('school', () => {
  it('cleans topics', () => {
    expect(cleanTopics([' C ', 'c', 'Unix', '<script>', 'a'.repeat(50), 42, 'Data  Structures'])).toEqual(['c', 'unix', 'data structures']);
    expect(cleanTopics('nope')).toEqual([]);
    expect(cleanTopics(Array.from({ length: 20 }, (_, i) => `topic ${i}`))).toHaveLength(8);
  });

  it('has presets with topics for every year', () => {
    for (const s of SCHOOL_PRESETS) {
      expect(s.years.length).toBeGreaterThan(0);
      for (const y of s.years) expect(y.length).toBeGreaterThan(0);
    }
  });

  it('builds a stage only when there are topics', () => {
    expect(schoolStage([], 'Epitech')).toBeNull();
    const st = schoolStage(['c', 'unix'], 'Epitech')!;
    expect(st.title).toContain('Epitech');
    expect(st.slots.some((s) => s.terms.includes('c'))).toBe(true);
  });

  it('parseProfile keeps school fields only when a school is named', () => {
    const base = { goal: 'backend', level: 'basics', style: 'mixed', hoursPerWeek: 6, languages: [] };
    const withSchool = parseProfile({ ...base, school: 'Epitech', schoolYear: 2, schoolTopics: ['C', 'Unix'] });
    expect(withSchool.ok && withSchool.profile.schoolTopics).toEqual(['c', 'unix']);
    const without = parseProfile({ ...base, school: '', schoolYear: 2, schoolTopics: ['C'] });
    expect(without.ok && without.profile.schoolTopics).toEqual([]);
    expect(parseProfile({ ...base, school: 'X', schoolYear: 99 }).ok).toBe(false);
    const silent = parseProfile(base);
    expect(silent.ok && 'school' in silent.profile).toBe(false); // no mention: stored value is kept
  });

  let n = 0;
  const it_ = (type: string, title: string, over: Partial<CatalogItem> = {}): CatalogItem => ({ id: `id-${++n}`, type, title, summary: '', source: 't', categories: [], meta: {}, ...over });
  const profile = (over: Partial<LearnerProfile> = {}): LearnerProfile => ({ goal: 'backend', level: 'basics', languages: ['Python'], hoursPerWeek: 8, style: 'mixed', ...over });

  it('a personal path no longer carries a school stage: school has its own path', () => {
    const catalog = [it_('roadmap', 'Backend roadmap', { meta: { slug: 'backend' } }), it_('video', 'Python for backend developers', { meta: { durationSeconds: 3000 } })];
    expect(generatePath(profile({ school: 'Epitech', schoolTopics: ['c'] }), catalog).stages.some((s) => /school|Epitech/i.test(s.title))).toBe(false);
  });

  it('ranks school topics higher but does not let off-topic items in', () => {
    const slot = { type: 'video' as const, terms: ['python'], count: 1 };
    const plain = it_('video', 'Python crash course', { meta: { durationSeconds: 3000 } });
    const unrelated = it_('video', 'Learn C programming', { meta: { durationSeconds: 3000 } });
    const p = profile({ schoolTopics: ['c'] });
    expect(scoreItem(unrelated, slot, p, ['Python'], [])).toBe(0); // not about python: still out
    expect(scoreItem(plain, slot, p, ['Python'], [])).toBeGreaterThan(0);
    const boosted = it_('video', 'Python and C interop', { meta: { durationSeconds: 3000 } });
    expect(scoreItem(boosted, slot, p, ['Python'], [])).toBeGreaterThan(scoreItem(boosted, slot, profile(), ['Python'], []));
  });
});

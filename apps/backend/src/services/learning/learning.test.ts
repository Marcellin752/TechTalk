import { describe, it, expect } from 'vitest';
import { estimateMinutes, generatePath, hasTerm, looksEnglish, scoreItem, type CatalogItem, type LearnerProfile } from './generator.js';
import { assemblePathView } from './view.js';
import { TEMPLATES, GOALS, LEVELS } from './templates.js';
import { parseProfile } from '../../controllers/learning.controller.js';
import { vi } from 'vitest';

vi.mock('../../db/db.js', () => ({ db: {} }));

let n = 0;
const item = (type: string, title: string, over: Partial<CatalogItem> = {}): CatalogItem => ({
  id: `id-${++n}`, type, title, summary: '', source: 'test', categories: [], meta: {}, ...over,
});
const profile = (over: Partial<LearnerProfile> = {}): LearnerProfile => ({ goal: 'frontend', level: 'beginner', languages: ['JavaScript'], hoursPerWeek: 5, style: 'mixed', ...over });

describe('matching', () => {
  it('matches whole words only', () => {
    expect(hasTerm('The Capital Cost of Power', 'api')).toBe(false);
    expect(hasTerm('Build an API in Node', 'api')).toBe(true);
    expect(hasTerm('Learn C++ in a week', 'c++')).toBe(true);
    expect(hasTerm('Maintaining state', 'ai')).toBe(false);
  });
  it('rejects translated duplicates', () => {
    expect(looksEnglish('CS50x em Português - Aula 8')).toBe(false);
    expect(looksEnglish('CS50x en Español - Clase 8')).toBe(false);
    expect(looksEnglish('CS50x 2026 - Lecture 8')).toBe(true);
    expect(looksEnglish('Python 初心者向け講座')).toBe(false);
  });
});

describe('time estimates', () => {
  it('estimates by kind', () => {
    expect(estimateMinutes(item('video', 'v', { meta: { durationSeconds: 3600 } }))).toBe(60);
    expect(estimateMinutes(item('video', 'v', { meta: { durationSeconds: 99999 } }))).toBe(240);
    expect(estimateMinutes(item('exercise', 'e', { meta: { difficulty: 'hard' } }))).toBe(60);
    expect(estimateMinutes(item('doc', 'd'))).toBe(20);
  });
});

describe('scoring', () => {
  const slot = { type: 'exercise', terms: [], count: 3 } as const;
  it('never gives a beginner a hard exercise', () => {
    const hard = item('exercise', 'x', { meta: { difficulty: 'hard', platform: 'Codewars' } });
    const easy = item('exercise', 'y', { meta: { difficulty: 'beginner', platform: 'Codewars' } });
    expect(scoreItem(hard, slot, profile(), ['JavaScript'], [])).toBe(0);
    expect(scoreItem(easy, slot, profile(), ['JavaScript'], [])).toBeGreaterThan(0);
  });
  it('prefers exercises in the learner\'s language and mixes platforms', () => {
    const js = item('exercise', 'a', { meta: { difficulty: 'easy', platform: 'Codewars', languages: ['javascript'] } });
    const rb = item('exercise', 'b', { meta: { difficulty: 'easy', platform: 'Codewars', languages: ['ruby'] } });
    expect(scoreItem(js, slot, profile(), ['JavaScript'], [])).toBeGreaterThan(scoreItem(rb, slot, profile(), ['JavaScript'], []));
    const sameBefore = [item('exercise', 'c', { meta: { platform: 'Codewars' } })];
    expect(scoreItem(js, slot, profile(), ['JavaScript'], sameBefore)).toBeLessThan(scoreItem(js, slot, profile(), ['JavaScript'], []));
  });
  it('needs the title or tags, not just the summary', () => {
    const slot2 = { type: 'course', terms: ['react'], count: 1 } as const;
    const aboutIt = item('course', 'React for beginners');
    const mention = item('course', 'Learn Kotlin', { summary: 'compared with react' });
    expect(scoreItem(aboutIt, slot2, profile(), [], [])).toBeGreaterThan(0);
    expect(scoreItem(mention, slot2, profile(), [], [])).toBe(0);
  });
});

describe('generatePath', () => {
  const catalog: CatalogItem[] = [
    item('roadmap', 'CSS roadmap', { meta: { slug: 'css' } }),
    item('roadmap', 'JavaScript roadmap', { meta: { slug: 'javascript' } }),
    item('roadmap', 'React roadmap', { meta: { slug: 'react' } }),
    item('course', 'Responsive Web Design', { meta: { kind: 'certification', blocks: 10 } }),
    item('course', 'JavaScript Algorithms', { meta: { kind: 'certification', blocks: 10 } }),
    item('doc', 'CSS grid layout'),
    item('doc', 'Using the Fetch API'),
    item('video', 'JavaScript full course', { meta: { durationSeconds: 7200, learn: true } }),
    item('repo', 'facebook/react', { meta: { stars: 200000 } }),
    ...Array.from({ length: 30 }, (_, i) => item('exercise', `Kata ${i}`, { meta: { difficulty: i % 2 ? 'easy' : 'beginner', platform: i % 3 ? 'Codewars' : 'Codeforces', languages: ['javascript'], solved: 1000 + i } })),
  ];

  it('builds ordered stages, each with steps, with no resource used twice', () => {
    const path = generatePath(profile(), catalog);
    expect(path.stages.length).toBeGreaterThanOrEqual(3);
    const ids = path.stages.flatMap((s) => s.steps.map((x) => x.contentId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(path.totalMinutes).toBe(path.stages.reduce((n, s) => n + s.minutes, 0));
    path.stages.forEach((s, i) => expect(s.index).toBe(i));
  });

  it('orients first, then learns, then practises', () => {
    const stage = generatePath(profile(), catalog).stages[0]!;
    const order = ['orient', 'learn', 'practice', 'project', 'read'];
    const kinds = stage.steps.map((s) => order.indexOf(s.kind));
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });

  it('skips foundations for an advanced learner and keeps them for a beginner', () => {
    const beginner = generatePath(profile({ level: 'beginner' }), catalog).stages.map((s) => s.title);
    const advanced = generatePath(profile({ level: 'advanced' }), catalog).stages.map((s) => s.title);
    expect(beginner).toContain('How the web works, HTML and CSS');
    expect(advanced).not.toContain('How the web works, HTML and CSS');
  });

  it('gives a practice-minded learner more exercises', () => {
    const count = (style: LearnerProfile['style']) =>
      generatePath(profile({ style }), catalog).stages.flatMap((s) => s.steps).filter((s) => s.kind === 'practice').length;
    expect(count('practice')).toBeGreaterThan(count('mixed'));
  });

  it('returns no stages when the catalogue is empty', () => {
    expect(generatePath(profile(), []).stages).toHaveLength(0);
  });

  it('has a template for every goal and level', () => {
    for (const goal of GOALS) for (let l = 0; l < LEVELS.length; l++) {
      expect(TEMPLATES[goal].filter((s) => l >= s.from && l <= s.to).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('profile validation', () => {
  const good = { goal: 'backend', level: 'basics', languages: ['Python'], hoursPerWeek: 6, style: 'mixed' };
  it('accepts a valid profile', () => {
    expect(parseProfile(good)).toMatchObject({ ok: true });
  });
  it('rejects bad choices with a clear message', () => {
    expect(parseProfile({ ...good, goal: 'astrology' })).toMatchObject({ ok: false });
    expect(parseProfile({ ...good, level: 'god' })).toMatchObject({ ok: false });
    expect(parseProfile({ ...good, hoursPerWeek: 0 })).toMatchObject({ ok: false });
    expect(parseProfile({ ...good, hoursPerWeek: 99 })).toMatchObject({ ok: false });
    expect(parseProfile({ ...good, languages: ['Brainfuck'] })).toMatchObject({ ok: false });
    expect(parseProfile({ ...good, languages: ['Python', 'Rust', 'Go', 'Java', 'C++', 'SQL'] })).toMatchObject({ ok: false });
  });
});

describe('path view', () => {
  const content = { id: 'c', type: 'doc', title: 't', url: 'u', source: 's', summary: null, image: null, meta: null };
  const path = { id: 'p', title: 'T', goal: 'frontend', level: 'beginner', hoursPerWeek: 5, totalMinutes: 100, createdAt: new Date(), stages: [{ index: 0, title: 'A', objective: '', minutes: 60 }, { index: 1, title: 'B', objective: '', minutes: 40 }] };
  const step = (position: number, stage: number, status: string, minutes: number) => ({ id: `s${position}`, position, stage, kind: 'learn', minutes, status, completedAt: null, content });

  it('computes progress, the current stage and the next step', () => {
    const v = assemblePathView(path as any, [step(0, 0, 'done', 30), step(1, 0, 'todo', 30), step(2, 1, 'todo', 40)]);
    expect(v.progress).toMatchObject({ doneSteps: 1, totalSteps: 3, percent: 30, minutesDone: 30, minutesTotal: 100 });
    expect(v.next?.id).toBe('s1');
    expect(v.currentStage).toBe(0);
    expect(v.stages[0]).toMatchObject({ done: 1, total: 2, complete: false });
  });
  it('prefers a step in progress as the next one, and ends cleanly when all is done', () => {
    const doing = assemblePathView(path as any, [step(0, 0, 'todo', 30), step(1, 0, 'doing', 30)]);
    expect(doing.next?.id).toBe('s1');
    const done = assemblePathView(path as any, [step(0, 0, 'done', 60), step(1, 1, 'done', 40)]);
    expect(done.next).toBeNull();
    expect(done.progress.percent).toBe(100);
    expect(done.stages.every((s) => s.complete)).toBe(true);
  });
});

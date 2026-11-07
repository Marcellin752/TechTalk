import { describe, it, expect, vi } from 'vitest';
import { EPITECH_PROGRAMME } from './learning/epitech.js';
import { parseCurriculum, parseProgramme, presetCurriculum, topicsFromProgramme } from './schools.js';
import { generateSchoolPath, generatePath, projectTemplate, suitableForPath, type CatalogItem, type LearnerProfile } from './learning/generator.js';

vi.mock('../db/db.js', () => ({ db: {} }));

describe('the Epitech starter programme', () => {
  it('passes its own validation', () => {
    const r = parseProgramme(EPITECH_PROGRAMME);
    expect(r.ok).toBe(true);
  });
  it('covers five years, each with projects, and is a draft until the school confirms it', () => {
    expect(EPITECH_PROGRAMME.status).toBe('draft');
    expect(EPITECH_PROGRAMME.years.map((y) => y.year)).toEqual([1, 2, 3, 4, 5]);
    for (const y of EPITECH_PROGRAMME.years) expect(y.projects.length).toBeGreaterThan(0);
  });
  it('gives every project topics (they pick its resources) and a unique name', () => {
    const names = new Set<string>();
    for (const y of EPITECH_PROGRAMME.years) for (const p of y.projects) {
      expect(p.topics.length, p.name).toBeGreaterThan(0);
      expect(names.has(p.name), `duplicate ${p.name}`).toBe(false);
      names.add(p.name);
    }
  });
  it('names the projects Epitech itself documents', () => {
    const all = EPITECH_PROGRAMME.years.flatMap((y) => y.projects.map((p) => p.name)).join(' | ');
    expect(all).toMatch(/Indie Studio/);
    expect(all).toMatch(/Zappy/);
  });
  it('is what the preset hands out, with the flat topic list derived from it', () => {
    const c = presetCurriculum('epitech')!;
    expect(c.programme).toBe(EPITECH_PROGRAMME);
    expect(c.years[0]).toContain('c');
    expect(c.years).toHaveLength(5);
  });
});

describe('parseProgramme', () => {
  const ok = { years: [{ year: 1, title: 'Year one', projects: [{ name: ' Shell ', topics: ['C', 'Unix', 'c'], hours: 40, kind: 'project', summary: 'A shell.' }] }] };
  it('cleans and accepts a good one, defaulting to draft', () => {
    const r = parseProgramme(ok);
    expect(r.ok && r.programme.status).toBe('draft');
    expect(r.ok && r.programme.years[0]!.projects[0]).toEqual({ name: 'Shell', topics: ['c', 'unix'], summary: 'A shell.', kind: 'project', hours: 40 });
  });
  it('lets the school confirm it', () => {
    const r = parseProgramme({ ...ok, status: 'confirmed' });
    expect(r.ok && r.programme.status).toBe('confirmed');
  });
  it('refuses what cannot work, saying what', () => {
    expect(parseProgramme({}).ok).toBe(false);
    expect(parseProgramme({ years: [{ year: 1, title: 'x', projects: [] }] }).ok).toBe(false);
    expect(parseProgramme({ years: [{ year: 1, title: 'x', projects: [{ name: 'p', topics: [] }] }] }).ok).toBe(false);
    expect(parseProgramme({ years: [{ year: 9, title: 'x', projects: [{ name: 'p', topics: ['c'] }] }] }).ok).toBe(false);
    expect(parseProgramme({ years: [ok.years[0], ok.years[0]] }).ok).toBe(false);
    expect(parseProgramme({ years: [{ year: 1, title: 'x', projects: [{ name: 'p', topics: ['c'], kind: 'party' }] }] }).ok).toBe(false);
    expect(parseProgramme({ years: [{ year: 1, title: 'x', projects: [{ name: 'p', topics: ['c'], hours: 9999 }] }] }).ok).toBe(false);
  });
  it('derives the flat topics, leaving a year without projects empty', () => {
    const p = parseProgramme({ years: [{ year: 1, title: 'a', projects: [{ name: 'p', topics: ['c'] }] }, { year: 3, title: 'c', projects: [{ name: 'q', topics: ['web'] }] }] });
    expect(p.ok && topicsFromProgramme(p.programme)).toEqual([['c'], [], ['web']]);
  });
});

describe('parseCurriculum with a programme', () => {
  it('takes a programme alone and derives the topics', () => {
    const r = parseCurriculum({ programme: { years: [{ year: 1, title: 'a', projects: [{ name: 'p', topics: ['c', 'unix'] }] }] } });
    expect(r.ok && r.curriculum.years).toEqual([['c', 'unix']]);
    expect(r.ok && r.curriculum.programme?.years).toHaveLength(1);
  });
  it('still takes the simple form', () => {
    const r = parseCurriculum({ years: [['c']] });
    expect(r.ok && r.curriculum).toEqual({ years: [['c']] });
  });
  it('reports a problem in the programme', () => {
    expect(parseCurriculum({ programme: { years: [] } }).ok).toBe(false);
  });
});

describe('the school path', () => {
  let n = 0;
  const item = (type: string, title: string, over: Partial<CatalogItem> = {}): CatalogItem => ({ id: `id-${++n}`, type, title, summary: '', source: 't', categories: [], meta: {}, ...over });
  const profile: LearnerProfile = { goal: 'backend', level: 'basics', languages: [], hoursPerWeek: 6, style: 'mixed' };
  const year = { year: 1, title: 'Year 1', projects: [
    { name: 'Minishell', topics: ['c', 'unix', 'processes'], hours: 40, kind: 'project' as const, summary: 'A shell.' },
    { name: 'my_hunter', topics: ['graphics', 'csfml'], hours: 30 },
  ] };
  const catalog = [
    item('video', 'Unix processes explained', { meta: { durationSeconds: 3000 } }),
    item('doc', 'The C programming language and Unix', { categories: ['c'] }),
    item('exercise', 'Fork a process in C', { meta: { difficulty: 'easy', platform: 'Codewars', languages: ['C'] }, categories: ['c', 'processes'] }),
    item('video', 'CSFML graphics: draw sprites', { meta: { durationSeconds: 2400 } }),
    item('video', 'Cooking pasta in 10 minutes', { meta: { durationSeconds: 600 } }),
  ];

  it('makes a stage per project, in order, titled and described like the project', () => {
    const path = generateSchoolPath(profile, 'Epitech', year, catalog);
    expect(path.title).toBe('Epitech, year 1');
    expect(path.stages.map((s) => s.title)).toEqual(['Minishell', 'my_hunter']);
    expect(path.stages[0]!.objective).toBe('A shell.');
    expect(path.stages[0]!.topics).toEqual(['c', 'unix', 'processes']);
    expect(path.stages[0]!.kind).toBe('project');
  });

  it('puts in each stage only resources about that project', () => {
    const path = generateSchoolPath(profile, 'Epitech', year, catalog);
    const title = (id: string) => catalog.find((c) => c.id === id)!.title;
    const shell = path.stages[0]!.steps.map((s) => title(s.contentId)).join(' | ');
    const gfx = path.stages[1]!.steps.map((s) => title(s.contentId)).join(' | ');
    expect(shell).toMatch(/processes|Unix|Fork/);
    expect(shell).not.toMatch(/CSFML|pasta/);
    expect(gfx).toMatch(/CSFML/);
    expect(`${shell} ${gfx}`).not.toMatch(/pasta/);
  });

  it('does not pick a resource that matches only a side topic', () => {
    const shell = { year: 1, title: 'Y', projects: [{ name: 'my_printf', topics: ['c', 'strings'], hours: 30 }] };
    const cat = [item('doc', 'Introduction to Variables and Strings in JavaScript'), item('doc', 'Formatting strings in C with printf', { categories: ['c'] })];
    const path = generateSchoolPath(profile, 'Epitech', shell, cat);
    const picked = path.stages.flatMap((s) => s.steps.map((x) => cat.find((c) => c.id === x.contentId)!.title));
    expect(picked).toEqual(['Formatting strings in C with printf']);
  });

  it('never uses a resource twice', () => {
    const path = generateSchoolPath(profile, 'Epitech', year, catalog);
    const ids = path.stages.flatMap((s) => s.steps.map((x) => x.contentId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sizes the help around the project: longer projects get a larger share', () => {
    const big = projectTemplate({ name: 'Big', topics: ['c'], hours: 150 });
    const small = projectTemplate({ name: 'Small', topics: ['c'], hours: 10 });
    expect(big.weight).toBeGreaterThan(small.weight);
    expect(small.weight).toBeGreaterThanOrEqual(90);
    expect(big.weight).toBeLessThanOrEqual(600);
  });

  it('leaves out a project nothing matches instead of padding it', () => {
    const path = generateSchoolPath(profile, 'Epitech', { year: 2, title: 'Y2', projects: [{ name: 'Obscure', topics: ['cobol-mainframes'] }, ...year.projects] }, catalog);
    expect(path.stages.map((s) => s.title)).not.toContain('Obscure');
    expect(path.stages.map((s) => s.index)).toEqual([0, 1]);
  });
});

describe('curated foundations', () => {
  it('every reference is well formed, tagged and unique', async () => {
    const { FOUNDATIONS } = await import('./automation/learn/foundations.js');
    const urls = new Set<string>();
    for (const r of FOUNDATIONS) {
      expect(r.url, r.title).toMatch(/^https:\/\//);
      expect(urls.has(r.url), `duplicate ${r.url}`).toBe(false);
      urls.add(r.url);
      expect(r.tags.length, r.title).toBeGreaterThan(0);
      expect(r.summary.length, r.title).toBeGreaterThan(20);
    }
  });
  it('covers the main topics of every Epitech project', async () => {
    const { FOUNDATIONS } = await import('./automation/learn/foundations.js');
    const covered = new Set(FOUNDATIONS.flatMap((r) => r.tags));
    for (const y of EPITECH_PROGRAMME.years) for (const p of y.projects) {
      expect(p.topics.slice(0, 2).some((t) => covered.has(t)), `${p.name} (${p.topics.slice(0, 2)})`).toBe(true);
    }
  });
});

describe('what belongs in a learning path', () => {
  const mk = (type: string, title: string, meta: Record<string, unknown> = {}): CatalogItem => ({ id: title, type, title, summary: '', source: 't', categories: [], meta });
  const beginner = { level: 'beginner' as const };
  const advanced = { level: 'advanced' as const };

  it('leaves out talk shows, interviews and off-topic subjects', () => {
    expect(suitableForPath(mk('video', 'What is the Probability of Doom? | The CS50 Show with David J. Malan | Season 1, Episode 1'), beginner)).toBe(false);
    expect(suitableForPath(mk('video', 'Algorithmic trading with Python: build a bot'), beginner)).toBe(false);
    expect(suitableForPath(mk('video', 'Interview with a senior engineer'), advanced)).toBe(false);
    expect(suitableForPath(mk('course', 'CS50x 2026 - Lecture 3 - Algorithms'), beginner)).toBe(true);
  });
  it('keeps research papers for people who can read them', () => {
    expect(suitableForPath(mk('paper', 'Attention is all you need'), beginner)).toBe(false);
    expect(suitableForPath(mk('paper', 'Attention is all you need'), { level: 'basics' })).toBe(false);
    expect(suitableForPath(mk('paper', 'Attention is all you need'), { level: 'intermediate' })).toBe(true);
  });
  it('never puts a job offer in a path; a beginner-friendly issue only after the basics', () => {
    expect(suitableForPath(mk('opportunity', 'Senior engineer, remote', { kind: 'job' }), advanced)).toBe(false);
    expect(suitableForPath(mk('opportunity', 'Fix typo in docs', { kind: 'issue' }), beginner)).toBe(false);
    expect(suitableForPath(mk('opportunity', 'Fix typo in docs', { kind: 'issue' }), { level: 'basics' })).toBe(true);
  });
  it('a generated path honours all of it', () => {
    const cat = [
      mk('roadmap', 'Backend roadmap', { slug: 'backend' }),
      mk('video', 'Python lecture for the backend', { durationSeconds: 3000 }),
      mk('video', 'The CS50 Show: Python episode', { durationSeconds: 3000 }),
      mk('paper', 'A paper about Python databases'),
      mk('opportunity', 'Python developer wanted', { kind: 'job' }),
    ];
    const path = generatePath({ goal: 'backend', level: 'beginner', languages: ['Python'], hoursPerWeek: 6, style: 'mixed' }, cat);
    const titles = path.stages.flatMap((s) => s.steps.map((x) => cat.find((c) => c.id === x.contentId)!.title));
    expect(titles.join(' | ')).not.toMatch(/CS50 Show|paper|wanted/);
  });
});

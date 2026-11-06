import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ config: { github: { token: 't' }, scrapers: { youtubeApiKey: 'k' } } }));
vi.mock('../../db/db.js', () => ({ db: {} }));

import { plainTeaser, decodeEntities } from './store.js';
import { roadmapTitle, countTopics, roadmapRow } from './learn/roadmaps.js';
import { fccRows, ODIN_PATHS, exercismRows } from './learn/curricula.js';
import { parseArxivAtom, paperRow } from './learn/arxiv.js';
import { mdnRow } from './learn/mdn.js';
import { isoToSeconds, uploadsPlaylistId } from './learn/youtube-learn.js';
import { kataDifficulty, kataRow, KATA_SLUGS } from './practice/codewars.js';
import { cfDifficulty, pickProblems, problemRow } from './practice/codeforces.js';
import { questionRow } from './practice/stackexchange.js';
import { cgDifficulty, puzzleRow } from './practice/codingame.js';

describe('text helpers', () => {
  it('decodes entities and makes plain teasers', () => {
    expect(decodeEntities('Tom &amp; Jerry&#39;s &quot;x&quot;')).toBe('Tom & Jerry\'s "x"');
    const t = plainTeaser('<p>Hello <b>world</b></p><pre>code()</pre> and [a link](https://x.dev)', 50);
    expect(t).toBe('Hello world and a link');
    expect(plainTeaser('word '.repeat(100), 40).endsWith('…')).toBe(true);
  });
});

describe('roadmap.sh', () => {
  it('names roadmaps readably', () => {
    expect(roadmapTitle('frontend')).toBe('Frontend');
    expect(roadmapTitle('ai-engineer')).toBe('AI Engineer');
    expect(roadmapTitle('devops')).toBe('DevOps');
    expect(roadmapTitle('datastructures-and-algorithms')).toBe('Data Structures and Algorithms');
  });
  it('counts topics per roadmap from the file listing and links out', () => {
    const counts = countTopics(['roadmaps/react/content/a@1.md', 'roadmaps/react/content/b@2.md', 'roadmaps/react/readme.md', 'roadmaps/css/content/c@3.md', 'src/x.md']);
    expect(counts.get('react')).toBe(2);
    expect(counts.get('css')).toBe(1);
    const row = roadmapRow('frontend-beginner', 40);
    expect(row).toMatchObject({ type: 'roadmap', source: 'roadmap.sh', url: 'https://roadmap.sh/frontend-beginner' });
    expect(row.meta).toMatchObject({ topics: 40, level: 'beginner' });
  });
});

describe('curricula', () => {
  it('turns freeCodeCamp superblocks into courses and skips legacy ones', () => {
    const rows = fccRows({
      'javascript-v9': { title: 'JavaScript V9', intro: ['Learn JavaScript from scratch.'], blocks: { a: {}, b: {} } },
      'responsive-web-design': { title: 'Legacy Responsive Web Design V8', intro: ['old'] },
      'old-v8': { title: 'Relational Database V8', intro: ['Old.'] },
      'a1-spanish': { title: 'A1 Professional Spanish Certification (Beta)', intro: ['Spanish.'] },
      'not-a-superblock': {},
    } as any);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'JavaScript', url: 'https://www.freecodecamp.org/learn/javascript-v9/', type: 'course' });
    expect(rows[0].meta).toMatchObject({ blocks: 2 });
  });
  it('ships Odin and Exercism entries as courses', () => {
    expect(ODIN_PATHS.every((r) => r.type === 'course' && r.url.startsWith('https://www.theodinproject.com'))).toBe(true);
    expect(exercismRows.length).toBeGreaterThan(5);
    expect(exercismRows[0].url).toMatch(/^https:\/\/exercism\.org\/tracks\//);
  });
});

describe('arXiv', () => {
  const xml = `<feed><entry><id>http://arxiv.org/abs/2401.01234v2</id><published>2024-01-02T00:00:00Z</published>
    <title>A Survey of
     Things</title><summary>  We review &amp; compare many things.  </summary>
    <author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author>
    <arxiv:primary_category xmlns:arxiv="x" term="cs.LG" scheme="s"/></entry></feed>`;
  it('parses the Atom feed', () => {
    const [e] = parseArxivAtom(xml);
    expect(e).toMatchObject({ id: '2401.01234', title: 'A Survey of Things', abstract: 'We review & compare many things.', primaryCategory: 'cs.LG' });
    expect(e.authors).toEqual(['Ada Lovelace', 'Alan Turing']);
  });
  it('maps a paper with its pdf and field', () => {
    const row = paperRow(parseArxivAtom(xml)[0], 'survey', 'Machine Learning');
    expect(row).toMatchObject({ type: 'paper', source: 'arXiv', url: 'https://arxiv.org/abs/2401.01234' });
    expect(row.meta).toMatchObject({ kind: 'survey', pdf: 'https://arxiv.org/pdf/2401.01234', field: 'Machine Learning' });
  });
});

describe('MDN', () => {
  it('maps a page with its CC-BY-SA attribution', () => {
    const row = mdnRow({ mdn_url: '/en-US/docs/Web/API/Fetch_API', title: 'Fetch API', summary: 'The Fetch API provides an interface for fetching resources.', slug: 'web/api/fetch_api' });
    expect(row).toMatchObject({ type: 'doc', source: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API' });
    expect(row.meta).toMatchObject({ license: 'CC-BY-SA 2.5', attribution: 'MDN contributors' });
  });
});

describe('YouTube learning videos', () => {
  it('reads ISO durations and derives the uploads playlist id', () => {
    expect(isoToSeconds('PT1H2M3S')).toBe(3723);
    expect(isoToSeconds('PT45S')).toBe(45);
    expect(isoToSeconds('P0D')).toBe(0);
    expect(uploadsPlaylistId('UCcabW7890RKJzL968QWEykA')).toBe('UUcabW7890RKJzL968QWEykA');
  });
});

describe('practice platforms', () => {
  it('rates Codewars kata by kyu', () => {
    expect(kataDifficulty('8 kyu')).toBe('beginner');
    expect(kataDifficulty('5 kyu')).toBe('easy');
    expect(kataDifficulty('4 kyu')).toBe('medium');
    expect(kataDifficulty('1 kyu')).toBe('hard');
    const row = kataRow({ id: 'a', name: 'Multiply', slug: 'multiply', url: 'https://www.codewars.com/kata/a', description: 'Make it work', rank: { name: '8 kyu' }, tags: ['Fundamentals'], languages: ['js'] });
    expect(row).toMatchObject({ type: 'exercise', source: 'Codewars' });
    expect(row.meta).toMatchObject({ platform: 'Codewars', difficulty: 'beginner' });
    expect(new Set(KATA_SLUGS).size).toBe(KATA_SLUGS.length);
  });

  it('picks the most solved Codeforces problems per rating', () => {
    const problems = [
      { contestId: 1, index: 'A', name: 'A', rating: 800, tags: ['math'] },
      { contestId: 2, index: 'A', name: 'B', rating: 800, tags: ['dp'] },
      { contestId: 3, index: 'A', name: 'Hard', rating: 3000, tags: ['dp'] },
      { contestId: 4, index: 'A', name: 'NoRating', tags: [] },
      { contestId: 5, index: 'A', name: 'Special', rating: 800, tags: ['*special'] },
    ] as any;
    const stats = [{ contestId: 1, index: 'A', solvedCount: 10 }, { contestId: 2, index: 'A', solvedCount: 99 }];
    const picked = pickProblems(problems, stats as any);
    expect(picked.map((p) => p.name)).toEqual(['B', 'A']);
    expect(cfDifficulty(800)).toBe('beginner');
    expect(cfDifficulty(1200)).toBe('easy');
    expect(cfDifficulty(1600)).toBe('medium');
    expect(cfDifficulty(1900)).toBe('hard');
    expect(problemRow(picked[0]).url).toBe('https://codeforces.com/problemset/problem/2/A');
  });

  it('credits Stack Overflow and keeps an excerpt', () => {
    const row = questionRow({ question_id: 1, title: 'How do I &quot;map&quot;?', link: 'https://stackoverflow.com/questions/1/x?rq=1', body: '<p>I want to <code>map</code> things.</p>', score: 500, answer_count: 4, view_count: 9000, tags: ['javascript'], accepted_answer_id: 2 });
    expect(row).toMatchObject({ type: 'question', title: 'How do I "map"?', url: 'https://stackoverflow.com/questions/1/x' });
    expect(row.meta).toMatchObject({ attribution: 'Stack Overflow contributors', license: 'CC BY-SA' });
  });

  it('maps CodinGame puzzles', () => {
    expect(cgDifficulty('expert')).toBe('hard');
    const row = puzzleRow({ id: 1, level: 'easy', solvedCount: 12345, title: 'Horse-racing Duals', prettyId: 'horse-racing-duals', detailsPageUrl: '/training/easy/horse-racing-duals' });
    expect(row.url).toBe('https://www.codingame.com/training/easy/horse-racing-duals');
    expect(row.meta).toMatchObject({ platform: 'CodinGame', difficulty: 'easy' });
  });
});

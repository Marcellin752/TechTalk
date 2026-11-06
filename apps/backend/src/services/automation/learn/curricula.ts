import Parser from 'rss-parser';
import { classifyContent } from '../../../utils/classify.js';
import { sanitizeHtmlContent } from '../../../utils/html.js';
import { plainTeaser, saveContent, type ContentInput } from '../store.js';

/* Free, structured programs: freeCodeCamp certifications (read from its public
   repository), plus The Odin Project and Exercism, which have no usable API
   (Exercism's is behind a bot wall), so they are a short curated list.
   freeCodeCamp's blog feed also feeds the articles. */

const FCC_INTRO = 'https://raw.githubusercontent.com/freeCodeCamp/freeCodeCamp/main/client/i18n/locales/english/intro.json';

interface FccSuperblock {
  title?: string;
  intro?: string[];
  blocks?: Record<string, unknown>;
}

export function fccRows(intro: Record<string, FccSuperblock>): ContentInput[] {
  const rows: ContentInput[] = [];
  for (const [key, value] of Object.entries(intro)) {
    const title = value?.title;
    // Superblocks are the keys that carry a title and an intro; legacy ones are superseded.
    if (!title || !Array.isArray(value.intro) || !value.intro[0]) continue;
    // Superseded versions (legacy, V7/V8) and the human-language certifications are not for this section.
    if (/legacy|\bV[78]\b|chinese|spanish|english for developers/i.test(title)) continue;
    rows.push({
      title: title.replace(/\s+V\d+$/i, ''),
      url: `https://www.freecodecamp.org/learn/${key}/`,
      source: 'freeCodeCamp',
      type: 'course',
      summary: plainTeaser(value.intro[0], 320),
      categories: classifyContent(title, value.intro[0]),
      meta: { kind: 'certification', provider: 'freeCodeCamp', blocks: Object.keys(value.blocks ?? {}).length, free: true, license: 'BSD-3-Clause (code), CC-BY-SA 4.0 (curriculum)' },
    });
  }
  return rows;
}

export const ODIN_PATHS: ContentInput[] = [
  {
    title: 'The Odin Project: Foundations',
    url: 'https://www.theodinproject.com/paths/foundations/courses/foundations',
    source: 'The Odin Project',
    type: 'course',
    summary: 'The entry point: how the web works, the command line, Git, HTML, CSS and your first JavaScript, with projects to build as you go.',
    categories: ['Frontend'],
    meta: { kind: 'path', provider: 'The Odin Project', level: 'beginner', free: true },
  },
  {
    title: 'The Odin Project: Full Stack JavaScript',
    url: 'https://www.theodinproject.com/paths/full-stack-javascript',
    source: 'The Odin Project',
    type: 'course',
    summary: 'A complete path from the basics to Node, databases, testing and React, built around portfolio-ready projects.',
    categories: ['Frontend', 'Backend'],
    meta: { kind: 'path', provider: 'The Odin Project', level: 'intermediate', free: true },
  },
  {
    title: 'The Odin Project: Full Stack Ruby on Rails',
    url: 'https://www.theodinproject.com/paths/full-stack-ruby-on-rails',
    source: 'The Odin Project',
    type: 'course',
    summary: 'Learn Ruby, then build full applications with Rails, databases and testing.',
    categories: ['Backend'],
    meta: { kind: 'path', provider: 'The Odin Project', level: 'intermediate', free: true },
  },
];

const EXERCISM_TRACKS: Array<[slug: string, name: string, blurb: string]> = [
  ['javascript', 'JavaScript', 'Practice the language of the web with exercises and mentor feedback.'],
  ['typescript', 'TypeScript', 'Strengthen your JavaScript with types, one exercise at a time.'],
  ['python', 'Python', 'Learn Python through small exercises, with the option of mentoring.'],
  ['rust', 'Rust', 'Ownership, traits and fearless concurrency, learned by doing.'],
  ['go', 'Go', 'Simple, fast and concurrent: build fluency in Go.'],
  ['java', 'Java', 'Core Java and object-oriented design through graded exercises.'],
  ['csharp', 'C#', 'Modern C# and .NET fundamentals through practice.'],
  ['cpp', 'C++', 'Get comfortable with modern C++ in small, testable steps.'],
  ['ruby', 'Ruby', 'Expressive Ruby, practised with focused exercises.'],
  ['kotlin', 'Kotlin', 'Concise, safe Kotlin for Android and the server.'],
  ['swift', 'Swift', 'Swift fundamentals for Apple platforms and beyond.'],
  ['elixir', 'Elixir', 'Functional programming and concurrency on the BEAM.'],
  ['bash', 'Bash', 'Shell scripting, one small script at a time.'],
  ['sql', 'SQL', 'Querying and shaping data with SQL.'],
];

export const exercismRows: ContentInput[] = EXERCISM_TRACKS.map(([slug, name, blurb]) => ({
  title: `Exercism: ${name} track`,
  url: `https://exercism.org/tracks/${slug}`,
  source: 'Exercism',
  type: 'course',
  summary: blurb,
  categories: classifyContent(name, blurb),
  meta: { kind: 'track', provider: 'Exercism', language: name, free: true },
}));

const parser = new Parser();

async function fetchFccArticles(): Promise<number> {
  const feed = await parser.parseURL('https://www.freecodecamp.org/news/rss/');
  let n = 0;
  for (const item of feed.items) {
    if (!item.title || !item.link) continue;
    const html = (item as Record<string, string>)['content:encoded'] || item.content || '';
    await saveContent({
      title: item.title,
      url: item.link,
      source: 'freeCodeCamp',
      type: 'article',
      summary: plainTeaser(item.contentSnippet || html, 280),
      body: html ? sanitizeHtmlContent(html) : null,
      categories: classifyContent(item.title, item.contentSnippet),
      image: item.enclosure?.url ?? html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null,
      meta: { kind: 'tutorial', provider: 'freeCodeCamp' },
    });
    n++;
  }
  return n;
}

export async function fetchCurricula(): Promise<{ courses: number; articles: number }> {
  let courses = 0;
  const res = await fetch(FCC_INTRO, { headers: { 'user-agent': 'TechTalk' } });
  if (res.ok) {
    for (const row of fccRows((await res.json()) as Record<string, FccSuperblock>)) {
      await saveContent(row);
      courses++;
    }
  }
  for (const row of [...ODIN_PATHS, ...exercismRows]) {
    await saveContent(row);
    courses++;
  }
  const articles = await fetchFccArticles().catch(() => 0);
  return { courses, articles };
}

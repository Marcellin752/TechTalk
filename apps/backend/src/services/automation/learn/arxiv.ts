import { classifyContent } from '../../../utils/classify.js';
import { decodeEntities, saveContent, sleep, type ContentInput } from '../store.js';

/* arXiv: research papers, for the advanced end of learning. Its terms ask for
   at most one request every three seconds, so calls are spaced out. */

const CATEGORIES: Array<[code: string, label: string]> = [
  ['cs.LG', 'Machine Learning'],
  ['cs.AI', 'Artificial Intelligence'],
  ['cs.CL', 'Computation and Language'],
  ['cs.CV', 'Computer Vision'],
  ['cs.SE', 'Software Engineering'],
  ['cs.PL', 'Programming Languages'],
  ['cs.CR', 'Cryptography and Security'],
  ['cs.DS', 'Data Structures and Algorithms'],
  ['cs.DC', 'Distributed Computing'],
  ['cs.DB', 'Databases'],
];

export interface ArxivEntry {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  published: string;
  primaryCategory: string | null;
}

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();
const tag = (xml: string, name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)?.[1] ?? '';

/** Minimal parser for arXiv's very regular Atom feed. */
export function parseArxivAtom(xml: string): ArxivEntry[] {
  return xml
    .split('<entry>')
    .slice(1)
    .map((chunk) => {
      const entry = chunk.split('</entry>')[0]!;
      const idUrl = clean(tag(entry, 'id')); // http://arxiv.org/abs/2401.01234v2
      const id = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
      const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((m) => clean(m[1]!));
      return {
        id,
        title: clean(tag(entry, 'title')),
        abstract: clean(tag(entry, 'summary')),
        authors,
        published: clean(tag(entry, 'published')),
        primaryCategory: /<arxiv:primary_category[^>]*term="([^"]+)"/.exec(entry)?.[1] ?? null,
      };
    })
    .filter((e) => e.id && e.title && e.abstract);
}

export function paperRow(e: ArxivEntry, kind: 'recent' | 'survey', label: string): ContentInput {
  return {
    title: e.title,
    url: `https://arxiv.org/abs/${e.id}`,
    source: 'arXiv',
    type: 'paper',
    summary: e.abstract,
    categories: [...new Set([...classifyContent(e.title, e.abstract), ...(label ? [label] : [])])].slice(0, 4),
    meta: {
      kind,
      arxivId: e.id,
      authors: e.authors.slice(0, 6),
      moreAuthors: Math.max(0, e.authors.length - 6),
      published: e.published,
      category: e.primaryCategory,
      field: label,
      pdf: `https://arxiv.org/pdf/${e.id}`,
    },
  };
}

async function query(searchQuery: string, max: number): Promise<ArxivEntry[]> {
  const params = new URLSearchParams({ search_query: searchQuery, sortBy: 'submittedDate', sortOrder: 'descending', start: '0', max_results: String(max) });
  const res = await fetch(`https://export.arxiv.org/api/query?${params}`, { headers: { 'user-agent': 'TechTalk (educational aggregator)' } });
  if (!res.ok) throw new Error(`arXiv responded with ${res.status}`);
  return parseArxivAtom(await res.text());
}

export async function fetchArxiv(): Promise<number> {
  let saved = 0;
  for (const [code, label] of CATEGORIES) {
    // Surveys and tutorials teach; the latest submissions keep the section alive.
    const surveys = await query(`cat:${code} AND (ti:survey OR ti:tutorial OR ti:overview)`, 6).catch(() => []);
    await sleep(3200);
    const recent = await query(`cat:${code}`, 8).catch(() => []);
    await sleep(3200);
    for (const e of surveys) {
      await saveContent(paperRow(e, "survey", label));
      saved++;
    }
    for (const e of recent) {
      await saveContent(paperRow(e, "recent", label));
      saved++;
    }
  }
  return saved;
}

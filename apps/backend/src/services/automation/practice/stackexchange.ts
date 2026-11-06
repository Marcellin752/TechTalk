import { classifyContent } from '../../../utils/classify.js';
import { decodeEntities, plainTeaser, saveContent, sleep, type ContentInput } from '../store.js';

/* The best-voted answered questions per language or tool. Content is CC BY-SA:
   we keep a short excerpt, credit Stack Overflow and link to the question. */

const TAGS = ['typescript', 'javascript', 'python', 'rust', 'react', 'sql', 'git', 'docker', 'algorithm', 'java', 'node.js', 'linux'];

export interface SeQuestion {
  question_id: number;
  title: string;
  link: string;
  body?: string;
  score: number;
  answer_count: number;
  view_count: number;
  tags: string[];
  accepted_answer_id?: number;
}

export function questionRow(q: SeQuestion): ContentInput {
  const title = decodeEntities(q.title);
  return {
    title,
    url: q.link.split('?')[0]!,
    source: 'Stack Overflow',
    type: 'question',
    summary: plainTeaser(q.body, 260) || title,
    categories: classifyContent(title, q.tags.join(' ')),
    meta: {
      platform: 'Stack Overflow',
      score: q.score,
      answers: q.answer_count,
      views: q.view_count,
      tags: q.tags.slice(0, 5),
      license: 'CC BY-SA',
      attribution: 'Stack Overflow contributors',
    },
  };
}

export async function fetchStackOverflow(): Promise<number> {
  const key = process.env.STACKEXCHANGE_KEY; // optional: raises the daily quota
  let saved = 0;
  for (const tag of TAGS) {
    const params = new URLSearchParams({ order: 'desc', sort: 'votes', tagged: tag, site: 'stackoverflow', pagesize: '8', filter: 'withbody' });
    if (key) params.set('key', key);
    const res = await fetch(`https://api.stackexchange.com/2.3/questions?${params}`, { headers: { 'user-agent': 'TechTalk' } });
    if (res.status === 429 || res.status === 400) break; // throttled: keep what we have
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: SeQuestion[] };
    for (const q of data.items ?? []) {
      if (!q.accepted_answer_id) continue; // only questions that were actually answered
      await saveContent(questionRow(q));
      saved++;
    }
    await sleep(400);
  }
  return saved;
}

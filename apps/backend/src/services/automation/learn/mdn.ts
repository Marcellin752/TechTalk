import { classifyContent } from '../../../utils/classify.js';
import { decodeEntities, plainTeaser, saveContent, sleep, type ContentInput } from '../store.js';

/* MDN Web Docs, the web platform reference. Pages are CC-BY-SA, so every row
   carries the attribution and links back to the page instead of copying it. */

const QUERIES = [
  'javascript guide',
  'css layout',
  'html elements',
  'fetch api',
  'promises async await',
  'web accessibility',
  'http caching',
  'web components',
  'service workers',
  'css flexbox grid',
];

interface MdnDoc {
  mdn_url: string;
  title: string;
  summary?: string;
  slug: string;
  popularity?: number;
}

export function mdnRow(doc: MdnDoc): ContentInput {
  const summary = plainTeaser(doc.summary, 300) || doc.title;
  return {
    title: decodeEntities(doc.title),
    url: `https://developer.mozilla.org${doc.mdn_url}`,
    source: 'MDN Web Docs',
    type: 'doc',
    summary,
    categories: classifyContent(doc.title, `${summary} ${doc.slug}`),
    meta: {
      kind: 'reference',
      path: doc.mdn_url.replace('/en-US/docs/', ''),
      license: 'CC-BY-SA 2.5',
      attribution: 'MDN contributors',
    },
  };
}

export async function fetchMdn(): Promise<number> {
  const seen = new Set<string>();
  for (const q of QUERIES) {
    const res = await fetch(`https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(q)}&locale=en-US&size=6`, {
      headers: { 'user-agent': 'TechTalk' },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { documents?: MdnDoc[] };
    for (const doc of data.documents ?? []) {
      if (seen.has(doc.mdn_url)) continue;
      seen.add(doc.mdn_url);
      await saveContent(mdnRow(doc));
    }
    await sleep(300);
  }
  return seen.size;
}

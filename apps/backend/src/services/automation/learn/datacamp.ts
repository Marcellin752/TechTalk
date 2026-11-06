import { classifyContent } from '../../../utils/classify.js';
import { saveContent, type ContentInput } from '../store.js';

/* DataCamp has no public API and its site sits behind a bot wall, so its guided
   data and AI projects cannot be imported automatically (and scraping it would
   go against its terms). Instead this is a hand-kept list: each entry links to
   DataCamp, with our own short description. Add entries by copying real URLs
   from datacamp.com/projects; nothing here is fetched from their site. */

export interface DatacampEntry {
  title: string;
  url: string;
  summary: string;
  level: 'beginner' | 'basics' | 'intermediate' | 'advanced';
  topics: string[];
}

export const DATACAMP_ENTRIES: DatacampEntry[] = [
  {
    title: 'DataCamp Projects: guided data and AI projects',
    url: 'https://www.datacamp.com/projects',
    summary: 'Hands-on projects in Python, SQL and R, from data cleaning to machine learning, each with a real dataset and step-by-step guidance. Some are free; most need a subscription.',
    level: 'basics',
    topics: ['python', 'sql', 'machine learning', 'data analysis', 'ai'],
  },
];

export function datacampRow(e: DatacampEntry): ContentInput {
  return {
    title: e.title,
    url: e.url,
    source: 'DataCamp',
    type: 'course',
    summary: e.summary,
    categories: [...new Set(['AI & ML', ...classifyContent(e.title, `${e.summary} ${e.topics.join(' ')}`)])].slice(0, 3),
    meta: { kind: 'project', provider: 'DataCamp', level: e.level, free: false, topics: e.topics },
  };
}

export async function fetchDatacamp(): Promise<number> {
  for (const e of DATACAMP_ENTRIES) await saveContent(datacampRow(e));
  return DATACAMP_ENTRIES.length;
}

import { config } from '../../../config/env.js';
import { classifyContent } from '../../../utils/classify.js';
import { saveContent, type ContentInput } from '../store.js';

/* roadmap.sh publishes one folder per career/technology. Its repository no
   longer exposes the diagrams' structure, and its content is not freely
   reusable, so each roadmap is indexed as a *link* with only our own wording
   and a topic count; the learner follows it on roadmap.sh itself. */

const TREE_URL = 'https://api.github.com/repos/kamranahmedse/developer-roadmap/git/trees/master?recursive=1';

const ACRONYMS = new Set(['ai', 'api', 'aws', 'css', 'html', 'ios', 'qa', 'seo', 'sql', 'ux', 'php', 'mlops', 'bi', 'r']);
const SPECIAL: Record<string, string> = {
  devops: 'DevOps',
  devsecops: 'DevSecOps',
  nodejs: 'Node.js',
  nextjs: 'Next.js',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  graphql: 'GraphQL',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
  golang: 'Go',
  cpp: 'C++',
  'git-github': 'Git and GitHub',
  'react-native': 'React Native',
  'shell-bash': 'Shell and Bash',
  'full-stack': 'Full Stack',
  'swift-ui': 'SwiftUI',
  'spring-boot': 'Spring Boot',
  'ruby-on-rails': 'Ruby on Rails',
  'datastructures-and-algorithms': 'Data Structures and Algorithms',
  'postgresql-dba': 'PostgreSQL DBA',
};

export function roadmapTitle(slug: string): string {
  if (SPECIAL[slug]) return SPECIAL[slug];
  const words = slug.split('-').map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)));
  return words.join(' ');
}

/** slug -> number of topic pages, from the repository's file listing. */
export function countTopics(paths: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const m = /^roadmaps\/([^/]+)\/content\/.+\.md$/.exec(p);
    if (m) counts.set(m[1]!, (counts.get(m[1]!) ?? 0) + 1);
  }
  return counts;
}

export function roadmapRow(slug: string, topics: number): ContentInput {
  const title = roadmapTitle(slug);
  const beginner = slug.endsWith('-beginner');
  return {
    title: `${title} roadmap`,
    url: `https://roadmap.sh/${slug}`,
    source: 'roadmap.sh',
    type: 'roadmap',
    summary: `A step-by-step learning path for ${title}${beginner ? ', made for newcomers' : ''}: what to learn, in a sensible order, with resources for each topic.`,
    categories: classifyContent(title, slug),
    image: null,
    meta: { kind: 'roadmap', slug, topics, level: beginner ? 'beginner' : 'all' },
  };
}

export async function fetchRoadmaps(): Promise<number> {
  const res = await fetch(TREE_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'TechTalk',
      ...(config.github.token ? { authorization: `Bearer ${config.github.token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`roadmap.sh listing responded with ${res.status}`);
  const data = (await res.json()) as { tree?: Array<{ path: string }> };
  const counts = countTopics((data.tree ?? []).map((t) => t.path));
  for (const [slug, n] of counts) await saveContent(roadmapRow(slug, n));
  return counts.size;
}

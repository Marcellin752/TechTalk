import type { StageTemplate } from './templates.js';

/**
 * What a learner studies at school, used to line the path up with it: the topics
 * become a dedicated stage, and resources about them rank higher everywhere else.
 * The presets are only a starting point the learner edits; any school can be typed.
 */
export interface SchoolPreset {
  id: string;
  name: string;
  /** Topics a typical programme covers, by year (index 0 = year 1). */
  years: string[][];
}

export const SCHOOL_PRESETS: SchoolPreset[] = [
  {
    id: 'epitech',
    name: 'Epitech',
    years: [
      ['c', 'unix', 'shell', 'git', 'algorithms'],
      ['c++', 'data structures', 'networking', 'object-oriented'],
      ['web', 'databases', 'docker', 'design patterns'],
      ['machine learning', 'security', 'devops', 'distributed systems'],
      ['system design', 'cloud', 'architecture'],
    ],
  },
  {
    id: '42',
    name: '42',
    years: [
      ['c', 'unix', 'shell', 'git', 'algorithms'],
      ['c++', 'networking', 'processes', 'data structures'],
      ['web', 'databases', 'docker', 'security'],
    ],
  },
  {
    id: 'epita',
    name: 'EPITA',
    years: [
      ['c', 'algorithms', 'unix', 'discrete math'],
      ['c++', 'data structures', 'operating systems', 'networking'],
      ['databases', 'web', 'machine learning', 'compilers'],
      ['security', 'distributed systems', 'cloud'],
      ['system design', 'architecture'],
    ],
  },
  {
    id: 'insa',
    name: 'INSA',
    years: [
      ['python', 'algorithms', 'discrete math'],
      ['java', 'data structures', 'databases', 'object-oriented'],
      ['web', 'networking', 'operating systems', 'software engineering'],
      ['machine learning', 'security', 'distributed systems'],
    ],
  },
  {
    id: 'university-cs',
    name: 'University (computer science)',
    years: [
      ['python', 'algorithms', 'discrete math', 'git'],
      ['java', 'data structures', 'databases', 'object-oriented'],
      ['operating systems', 'networking', 'web', 'software engineering'],
      ['machine learning', 'security', 'compilers'],
    ],
  },
  {
    id: 'bootcamp',
    name: 'Bootcamp',
    years: [['javascript', 'html', 'css', 'react', 'node', 'databases', 'git']],
  },
];

export const MAX_SCHOOL_TOPICS = 8;

/** Presets as the client needs them. */
export function schoolPresetsView() {
  return SCHOOL_PRESETS.map((s) => ({ id: s.id, name: s.name, years: s.years }));
}

/** Lower-cases, trims, drops duplicates and junk. */
export function cleanTopics(input: unknown, max = MAX_SCHOOL_TOPICS): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (t.length < 1 || t.length > 40 || !/^[a-z0-9+#.\- /]+$/.test(t)) continue;
    seen.add(t);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** A stage of its own: one lesson and one reading per topic, then practice across them. */
export function schoolStage(topics: string[], school: string | null | undefined): StageTemplate | null {
  const picked = topics.slice(0, 5);
  if (picked.length === 0) return null;
  return {
    title: school ? `At ${school}: reinforce what you study` : 'At school: reinforce what you study',
    objective: `Go deeper on ${picked.slice(0, 3).join(', ')}${picked.length > 3 ? ' and more' : ''}, so class and self-study feed each other.`,
    weight: 1.3,
    from: 0,
    to: 3,
    slots: [
      ...picked.map((t) => ({ type: 'video' as const, terms: [t], count: 1 })),
      ...picked.slice(0, 3).map((t) => ({ type: 'doc' as const, terms: [t], count: 1 })),
      { type: 'exercise' as const, terms: picked, count: 3 },
    ],
  };
}

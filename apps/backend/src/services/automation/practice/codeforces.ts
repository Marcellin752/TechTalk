import { classifyContent } from '../../../utils/classify.js';
import { saveContent, type ContentInput, type Difficulty } from '../store.js';

/* Codeforces' API lists every problem with its tags, rating and solve count
   (but not the statement, which stays on their site). We keep the most-solved
   problems of each rating, so the list is approachable and varied. */

interface CfProblem { contestId?: number; index: string; name: string; rating?: number; tags: string[] }
interface CfStat { contestId?: number; index: string; solvedCount: number }

const MIN_RATING = 800;
const MAX_RATING = 2000;
const PER_RATING = 6;

export function cfDifficulty(rating: number): Difficulty {
  if (rating <= 1000) return 'beginner';
  if (rating <= 1400) return 'easy';
  if (rating <= 1800) return 'medium';
  return 'hard';
}

/** Most-solved problems per rating bucket, between MIN_RATING and MAX_RATING. */
export function pickProblems(problems: CfProblem[], stats: CfStat[]): Array<CfProblem & { solved: number }> {
  const solvedBy = new Map(stats.map((s) => [`${s.contestId}${s.index}`, s.solvedCount]));
  const buckets = new Map<number, Array<CfProblem & { solved: number }>>();
  for (const p of problems) {
    if (!p.contestId || !p.rating || p.rating < MIN_RATING || p.rating > MAX_RATING) continue;
    if (p.tags.includes('*special')) continue;
    const list = buckets.get(p.rating) ?? [];
    list.push({ ...p, solved: solvedBy.get(`${p.contestId}${p.index}`) ?? 0 });
    buckets.set(p.rating, list);
  }
  return [...buckets.values()].flatMap((list) => list.sort((a, b) => b.solved - a.solved).slice(0, PER_RATING));
}

export function problemRow(p: CfProblem & { solved: number }): ContentInput {
  const tags = p.tags.slice(0, 5);
  return {
    title: p.name,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    source: 'Codeforces',
    type: 'exercise',
    summary: `Codeforces problem ${p.contestId}${p.index}, rated ${p.rating}. Topics: ${tags.join(', ') || 'general'}. Solved by ${p.solved.toLocaleString('en-US')} people.`,
    categories: classifyContent(p.name, tags.join(' ')).concat('Algorithms').slice(0, 3),
    meta: { platform: 'Codeforces', difficulty: cfDifficulty(p.rating!), rating: p.rating, tags, solved: p.solved },
  };
}

export async function fetchCodeforces(): Promise<number> {
  const res = await fetch('https://codeforces.com/api/problemset.problems', { headers: { 'user-agent': 'TechTalk' } });
  if (!res.ok) throw new Error(`Codeforces responded with ${res.status}`);
  const data = (await res.json()) as { status: string; result?: { problems: CfProblem[]; problemStatistics: CfStat[] } };
  if (data.status !== 'OK' || !data.result) throw new Error('Codeforces returned an error');
  const picked = pickProblems(data.result.problems, data.result.problemStatistics);
  for (const p of picked) await saveContent(problemRow(p));
  return picked.length;
}

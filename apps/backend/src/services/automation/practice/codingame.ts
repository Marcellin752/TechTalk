import { classifyContent } from '../../../utils/classify.js';
import { saveContent, type ContentInput, type Difficulty } from '../store.js';

/* CodinGame has no public API: this uses the same JSON endpoints its own site
   calls. They are unofficial and may change or be restricted, so everything
   here is defensive and a failure is only logged. */

const BASE = 'https://www.codingame.com/services/Puzzle';
const TOP = 60;

interface MinimalPuzzle { id: number; level: string; solvedCount: number; communityCreation?: boolean }
interface Puzzle extends MinimalPuzzle { title: string; prettyId: string; type?: string; detailsPageUrl?: string; attemptCount?: number }

export function cgDifficulty(level: string): Difficulty {
  if (level === 'easy') return 'easy';
  if (level === 'medium') return 'medium';
  return 'hard'; // hard, expert
}

export function puzzleRow(p: Puzzle): ContentInput {
  const url = p.detailsPageUrl ? `https://www.codingame.com${p.detailsPageUrl}` : `https://www.codingame.com/training/${p.level}/${p.prettyId}`;
  return {
    title: p.title,
    url,
    source: 'CodinGame',
    type: 'exercise',
    summary: `A ${p.level} CodinGame puzzle${p.type && p.type !== 'CODE' ? ` (${p.type.toLowerCase()})` : ''}: solve it in the browser, in the language of your choice. Solved by ${p.solvedCount.toLocaleString('en-US')} players.`,
    categories: classifyContent(p.title, 'puzzle algorithm').concat('Algorithms').slice(0, 3),
    meta: { platform: 'CodinGame', difficulty: cgDifficulty(p.level), level: p.level, solved: p.solvedCount, community: !!p.communityCreation },
  };
}

async function rpc<T>(method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TechTalk' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`CodinGame ${method} responded with ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchCodinGame(): Promise<number> {
  const all = await rpc<MinimalPuzzle[]>('findAllMinimalProgress', [null]);
  const top = [...all].sort((a, b) => b.solvedCount - a.solvedCount).slice(0, TOP);
  let saved = 0;
  for (let i = 0; i < top.length; i += 30) {
    const ids = top.slice(i, i + 30).map((p) => p.id);
    const detailed = await rpc<Puzzle[]>('findProgressByIds', [ids, null, 2]);
    for (const p of detailed) {
      if (!p.title || !p.prettyId) continue;
      await saveContent(puzzleRow(p));
      saved++;
    }
  }
  return saved;
}

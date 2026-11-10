import { classifyContent } from '../../../utils/classify.js';
import { plainTeaser, saveContent, sleep, type ContentInput, type Difficulty } from '../store.js';

/* Codewars has no listing endpoint, only "one kata by slug", so the exercises
   come from a curated list of well-known kata (each verified to exist). */

export const KATA_SLUGS = [
  'multiply', 'sum-of-positive', 'reversed-strings', 'even-or-odd', 'opposites-attract', 'return-negative',
  'remove-string-spaces', 'century-from-year', 'find-the-odd-int', 'highest-and-lowest', 'is-this-a-triangle',
  'count-the-smiley-faces', 'disemvowel-trolls', 'duplicate-encoder', 'who-likes-it', 'square-every-digit',
  'get-the-middle-character', 'jaden-casing-strings', 'create-phone-number', 'counting-duplicates',
  'playing-with-digits', 'stop-gninnips-my-sdrow', 'persistent-bugger', 'find-the-parity-outlier',
  'roman-numerals-encoder', 'roman-numerals-decoder', 'valid-parentheses', 'moving-zeros-to-the-end',
  'tribonacci-sequence', 'human-readable-time', 'directions-reduction', 'two-sum', 'where-my-anagrams-at',
  'snail', 'sudoku-solution-validator', 'strip-comments', 'next-bigger-number-with-the-same-digits',
  'the-observed-pin', 'rgb-to-hex-conversion', 'break-camelcase', 'bit-counting', 'mexican-wave',
  'unique-in-order', 'split-strings', 'vowel-count', 'simple-pig-latin', 'rot13-1', 'sum-of-pairs',
  'the-hashtag-generator',
];

interface Kata {
  id: string;
  name: string;
  slug: string;
  url: string;
  category?: string;
  description?: string;
  tags?: string[];
  languages?: string[];
  rank?: { id?: number; name?: string } | null;
  totalCompleted?: number;
  voteScore?: number;
}

/** 8 kyu is the easiest, 1 kyu the hardest. */
export function kataDifficulty(rankName: string | undefined): Difficulty {
  const kyu = Number(/(\d)\s*kyu/i.exec(rankName ?? '')?.[1] ?? 6);
  if (kyu >= 7) return 'beginner';
  if (kyu >= 5) return 'easy';
  if (kyu >= 3) return 'medium';
  return 'hard';
}

export function kataRow(k: Kata): ContentInput {
  return {
    title: k.name,
    url: k.url,
    source: 'Codewars',
    type: 'exercise',
    summary: plainTeaser(k.description, 260) || `A ${k.rank?.name ?? ''} kata on Codewars.`,
    categories: classifyContent(k.name, `${k.tags?.join(' ') ?? ''} ${k.description ?? ''}`.slice(0, 600)),
    meta: {
      platform: 'Codewars',
      difficulty: kataDifficulty(k.rank?.name),
      rating: k.rank?.name ?? null,
      tags: (k.tags ?? []).slice(0, 5),
      languages: (k.languages ?? []).slice(0, 8),
      solved: k.totalCompleted ?? 0,
      votes: k.voteScore ?? 0,
    },
  };
}

export async function fetchCodewars(): Promise<number> {
  let saved = 0;
  for (const slug of KATA_SLUGS) {
    try {
      const res = await fetch(`https://www.codewars.com/api/v1/code-challenges/${slug}`, { headers: { 'user-agent': 'TechTalk' } });
      if (!res.ok) continue;
      await saveContent(kataRow((await res.json()) as Kata));
      saved++;
    } catch {
      /* one missing kata must not stop the others */
    }
    await sleep(250);
  }
  return saved;
}

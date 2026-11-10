/* Linking a Codewars account: finding which of the learner's katas are solved.
   Codewars has no sign-in for third parties, so the username is a claim, not a proof:
   what it unlocks is convenience (steps tick themselves), never a credential. */

export const CODEWARS_USER = /^[A-Za-z0-9_.-]{2,40}$/;

export interface Solved { id: string; slug: string; completedAt: string }

export function kataKey(url: string): string | null {
  const m = url.match(/codewars\.com\/kata\/([0-9a-f]{24}|[a-z0-9][a-z0-9-]*)/i);
  return m ? m[1]!.toLowerCase() : null;
}

/** The ids of the steps whose kata the learner has solved. */
export function matchSolved(steps: Array<{ id: string; url: string }>, solved: Solved[]): string[] {
  const keys = new Set(solved.flatMap((s) => [s.id.toLowerCase(), s.slug.toLowerCase()]));
  return steps.filter((s) => {
    const key = kataKey(s.url);
    return key !== null && keys.has(key);
  }).map((s) => s.id);
}

/** Reads the solved katas (up to a few pages). Throws 'not_found' for an unknown user. */
export async function fetchSolved(username: string, fetcher: typeof fetch = fetch, maxPages = 6): Promise<Solved[]> {
  const out: Solved[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await fetcher(`https://www.codewars.com/api/v1/users/${encodeURIComponent(username)}/code-challenges/completed?page=${page}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) throw new Error('not_found');
    if (!res.ok) throw new Error(`codewars_${res.status}`);
    const body = (await res.json()) as { totalPages?: number; data?: Array<{ id?: string; slug?: string; completedAt?: string }> };
    for (const d of body.data ?? []) if (d.id && d.slug) out.push({ id: d.id, slug: d.slug, completedAt: d.completedAt ?? '' });
    if (page + 1 >= (body.totalPages ?? 1)) break;
  }
  return out;
}

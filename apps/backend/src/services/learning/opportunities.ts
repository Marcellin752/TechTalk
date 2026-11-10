/* Matching open-source issues and jobs to what a learner can actually do. */

export interface Opportunity { id: string; title: string; summary: string | null; url: string; source: string; meta: Record<string, any> | null; categories: string[] | null }

const words = (s: string) => s.toLowerCase();
const has = (text: string, term: string) => new RegExp(`(^|[^a-z0-9+#])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`, 'i').test(text);

export const looksLikeInternship = (o: Opportunity) => /\b(intern(ship)?|stage|stagiaire|alternance|apprenti(ce|ssage)?|co-?op|working student)\b/i.test(`${o.title} ${o.meta?.jobType ?? ''}`);

/** Where a learner is in their studies decides what is worth showing: early on, issues to learn from; later, internships and then jobs. */
export function stageOf(year: number | null | undefined): 'early' | 'mid' | 'late' {
  return year == null || year <= 1 ? 'early' : year <= 3 ? 'mid' : 'late';
}

export interface Ranked extends Opportunity { matched: string[]; score: number; kind: 'job' | 'issue'; internship: boolean }

/**
 * Ranks by how many of the learner's skills (languages, topics of the stages they validated) the
 * opportunity mentions. Nothing that matches no skill is shown: a list the learner cannot act on is noise.
 */
export function rankOpportunities(items: Opportunity[], skills: string[], year: number | null | undefined): Ranked[] {
  const stage = stageOf(year);
  const wanted = [...new Set(skills.map(words).filter((s) => s.length >= 1))];
  const out: Ranked[] = [];
  for (const o of items) {
    const kind: 'job' | 'issue' = o.meta?.kind === 'issue' ? 'issue' : 'job';
    const text = words([o.title, o.summary ?? '', (o.categories ?? []).join(' '), (o.meta?.tags ?? []).join?.(' ') ?? '', (o.meta?.labels ?? []).join?.(' ') ?? '', o.meta?.language ?? '', o.meta?.repo ?? ''].join(' '));
    const matched = wanted.filter((s) => has(text, s));
    if (matched.length === 0) continue;
    const internship = kind === 'job' && looksLikeInternship(o);
    let score = matched.length * 3;
    if (kind === 'issue') score += stage === 'early' ? 3 : stage === 'mid' ? 1 : 0;
    if (internship) score += stage === 'mid' ? 4 : stage === 'late' ? 2 : 0;
    if (kind === 'job' && !internship) score += stage === 'late' ? 3 : stage === 'mid' ? 0 : -2;
    if (kind === 'issue' && /good first issue|beginner|help wanted/i.test((o.meta?.labels ?? []).join?.(' ') ?? '')) score += 1;
    out.push({ ...o, matched, score, kind, internship });
  }
  return out.sort((a, b) => b.score - a.score);
}

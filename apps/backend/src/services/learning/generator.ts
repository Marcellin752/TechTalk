import { DEFAULT_LANGUAGES, GOAL_TITLES, LEVELS, TEMPLATES, type Goal, type Level, type Slot, type SlotType, type StageTemplate, type Style } from './templates.js';

export interface CatalogItem {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  source: string;
  categories: string[] | null;
  meta: Record<string, any> | null;
}

export interface LearnerProfile {
  goal: Goal;
  level: Level;
  languages: string[];
  hoursPerWeek: number;
  style: Style;
}

export type StepKind = 'orient' | 'learn' | 'practice' | 'project' | 'read';
export interface GeneratedStep { contentId: string; kind: StepKind; minutes: number }
export interface GeneratedStage { index: number; title: string; objective: string; minutes: number; steps: GeneratedStep[] }
export interface GeneratedPath { title: string; totalMinutes: number; stages: GeneratedStage[] }

const KIND: Record<string, StepKind> = {
  roadmap: 'orient', course: 'learn', video: 'learn', doc: 'learn',
  exercise: 'practice', question: 'practice', repo: 'project', opportunity: 'project', paper: 'read',
};

/** How long an item realistically takes. Long lectures are counted but capped. */
export function estimateMinutes(item: CatalogItem): number {
  const m = item.meta ?? {};
  switch (item.type) {
    case 'video': return Math.max(10, Math.min(240, Math.round(Number(m.durationSeconds ?? 1800) / 60)));
    case 'course': return m.kind === 'certification' ? Math.min(1500, Math.max(300, Number(m.blocks ?? 20) * 30)) : m.kind === 'track' ? 600 : Math.min(900, Math.max(120, Number(m.blocks ?? 8) * 40));
    case 'doc': return 20;
    case 'roadmap': return 30;
    case 'exercise': return ({ beginner: 15, easy: 25, medium: 40, hard: 60 } as Record<string, number>)[m.difficulty as string] ?? 30;
    case 'question': return 10;
    case 'paper': return m.kind === 'survey' ? 60 : 45;
    case 'repo': return 45;
    case 'opportunity': return 90;
    default: return 20;
  }
}

const WEEKS: Record<Level, number> = { beginner: 20, basics: 14, intermediate: 10, advanced: 8 };
const PREFERRED_DIFFICULTY: Record<Level, string[]> = {
  beginner: ['beginner', 'easy'],
  basics: ['easy', 'beginner'],
  intermediate: ['easy', 'medium'],
  advanced: ['medium', 'hard'],
};
const STAGE_MIN_STEPS = 3;
const STAGE_MAX_STEPS = 10;

/** Whole-word match, so "api" does not hit "capital" nor "ai" hit "maintain". */
export function hasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i').test(text);
}

export { looksEnglish } from '../automation/store.js';
import { looksEnglish } from '../automation/store.js';

function expandTerms(terms: string[], languages: string[]): string[] {
  return [...new Set(terms.flatMap((t) => (t === '$lang' ? languages.map((l) => l.toLowerCase()) : [t.toLowerCase()])))];
}

/** Relevance of one item for one slot. Zero means "not about this". */
export function scoreItem(item: CatalogItem, slot: Slot, profile: LearnerProfile, languages: string[], chosenInStage: CatalogItem[], stageBudget = Infinity): number {
  const m = item.meta ?? {};
  const terms = expandTerms(slot.terms, languages);
  const title = item.title.toLowerCase();
  const summary = (item.summary ?? '').toLowerCase();
  const tags = [...(item.categories ?? []), ...(Array.isArray(m.tags) ? m.tags : []), String(m.slug ?? ''), String(m.field ?? '')].join(' ').toLowerCase();

  let score = 0;
  for (const t of terms) {
    if (item.type === 'roadmap' && String(m.slug ?? '') === t) score += 8; // exact roadmap
    if (hasTerm(title, t)) score += 3;
    if (hasTerm(tags, t)) score += 2;
    if (hasTerm(summary, t)) score += 1;
  }

  if (slot.type === 'exercise') {
    const diff = String(m.difficulty ?? '');
    const preferred = PREFERRED_DIFFICULTY[profile.level];
    if (!preferred.includes(diff)) return 0; // never hand a beginner a "hard" problem
    score += preferred[0] === diff ? 4 : 2;
    const supported: string[] = Array.isArray(m.languages) ? m.languages.map((l: string) => l.toLowerCase()) : [];
    if (languages.some((l) => supported.includes(l.toLowerCase()))) score += 3;
    else if (supported.length > 0 && m.platform === 'Codewars') score -= 1;
    // Mix platforms inside a stage.
    score -= 1.5 * chosenInStage.filter((c) => c.type === 'exercise' && c.meta?.platform === m.platform).length;
    score += Math.log10(Number(m.solved ?? 0) + 1) / 4;
    return Math.max(score, 0.1);
  }

  if (slot.terms.length === 0) score = 1; // an open slot: any item qualifies, ranked by the bonuses below
  else if (score < 2) return 0; // a mention in the summary alone is not enough: the title or tags must be about it
  if (score === 0) return 0;
  // A single resource should not swallow most of a stage.
  if (estimateMinutes(item) > stageBudget * 0.6) score -= 2.5;
  if (item.type === 'course' && profile.level === 'beginner' && m.level === 'beginner') score += 2;
  if (item.type === 'video') {
    score += Math.log10(Number(m.views ?? 0) + 1) / 6;
    if (estimateMinutes(item) < 20) score -= 2; // a path is built on lessons, not on short explainers
  }
  if (item.type === 'repo') score += Math.log10(Number(m.stars ?? 0) + 1) / 4;
  if (item.type === 'question') score += Math.log10(Number(m.score ?? 0) + 1) / 4;
  if (profile.style === 'videos' && item.type === 'video') score += 1.5;
  if (profile.style === 'reading' && (item.type === 'doc' || item.type === 'paper')) score += 1.5;
  if (profile.style === 'practice' && item.type === 'exercise') score += 1.5;
  return score;
}

function slotCount(slot: Slot, style: Style): number {
  if (style === 'practice' && slot.type === 'exercise') return slot.count + 2;
  if (style === 'videos' && slot.type === 'video') return slot.count + 1;
  if (style === 'reading' && (slot.type === 'doc' || slot.type === 'paper')) return slot.count + 1;
  return slot.count;
}

interface Pick { item: CatalogItem; slotIndex: number; rank: number }

function fillStage(stage: StageTemplate, catalog: CatalogItem[], profile: LearnerProfile, languages: string[], used: Set<string>, budget: number): Pick[] {
  const picks: Pick[] = [];
  stage.slots.forEach((slot, slotIndex) => {
    const pool = catalog.filter((c) => c.type === slot.type && !used.has(c.id) && looksEnglish(c.title));
    const chosen: CatalogItem[] = [];
    for (let n = 0; n < slotCount(slot, profile.style); n++) {
      let best: CatalogItem | null = null;
      let bestScore = 0;
      for (const c of pool) {
        if (chosen.includes(c)) continue;
        const s = scoreItem(c, slot, profile, languages, [...picks.map((p) => p.item), ...chosen], budget);
        if (s > bestScore) (best = c), (bestScore = s);
      }
      if (!best) break;
      chosen.push(best);
      used.add(best.id);
      picks.push({ item: best, slotIndex, rank: n });
    }
  });
  return picks;
}

/** Brings a stage within its time budget. Long courses and videos beyond the first of
 *  their slot go first; exercises and projects are the last to be dropped. */
function fitBudget(picks: Pick[], budgetMinutes: number): Pick[] {
  const minutes = (ps: Pick[]) => ps.reduce((n, p) => n + estimateMinutes(p.item), 0);
  const protectedTypes = new Set(['exercise', 'repo', 'opportunity', 'roadmap']);
  let current = [...picks];
  while (minutes(current) > budgetMinutes * 1.3 && current.length > STAGE_MIN_STEPS) {
    const extras = current.filter((p) => p.rank > 0);
    const longLearning = extras.filter((p) => !protectedTypes.has(p.item.type)).sort((a, b) => estimateMinutes(b.item) - estimateMinutes(a.item))[0];
    const victim = longLearning ?? extras.sort((a, b) => b.slotIndex - a.slotIndex || b.rank - a.rank)[0];
    if (!victim) break;
    current = current.filter((p) => p !== victim);
  }
  return current.slice(0, STAGE_MAX_STEPS + 2);
}

const KIND_ORDER: StepKind[] = ['orient', 'learn', 'practice', 'project', 'read'];

/** Order inside a stage: orient, learn, practise, build, read. The learner's style decides what leads. */
function orderSteps(picks: Pick[], style: Style): Pick[] {
  const order = KIND_ORDER; // learn first, then practise, whatever the style: the style changes the mix, not the logic
  const typeOrder = style === 'videos' ? ['video', 'course', 'doc'] : style === 'reading' ? ['doc', 'course', 'video'] : ['course', 'video', 'doc'];
  return [...picks].sort((a, b) => {
    const ka = order.indexOf(KIND[a.item.type]!);
    const kb = order.indexOf(KIND[b.item.type]!);
    if (ka !== kb) return ka - kb;
    if (KIND[a.item.type] === 'learn') return typeOrder.indexOf(a.item.type) - typeOrder.indexOf(b.item.type) || a.slotIndex - b.slotIndex;
    return a.slotIndex - b.slotIndex || a.rank - b.rank;
  });
}

/** Builds a complete path: the stages a learner at this level needs, in order, each filled
 *  with the best resources in the catalogue and sized to the time they can give. */
export function generatePath(profile: LearnerProfile, catalog: CatalogItem[]): GeneratedPath {
  const levelIndex = LEVELS.indexOf(profile.level);
  const languages = profile.languages.length ? profile.languages : DEFAULT_LANGUAGES[profile.goal];
  const templates = TEMPLATES[profile.goal].filter((s) => levelIndex >= s.from && levelIndex <= s.to);
  const totalBudget = WEEKS[profile.level] * profile.hoursPerWeek * 60;
  const weightSum = templates.reduce((n, s) => n + s.weight, 0) || 1;
  const used = new Set<string>();

  const stages: GeneratedStage[] = [];
  for (const tpl of templates) {
    const budget = (totalBudget * tpl.weight) / weightSum;
    const picks = orderSteps(fitBudget(fillStage(tpl, catalog, profile, languages, used, budget), budget), profile.style);
    if (picks.length === 0) continue;
    const steps = picks.map((p) => ({ contentId: p.item.id, kind: KIND[p.item.type]!, minutes: estimateMinutes(p.item) }));
    stages.push({ index: stages.length, title: tpl.title, objective: tpl.objective, minutes: steps.reduce((n, s) => n + s.minutes, 0), steps });
  }

  const levelName = { beginner: 'from zero', basics: 'from the basics', intermediate: 'going deeper', advanced: 'advanced' }[profile.level];
  return {
    title: `${GOAL_TITLES[profile.goal]}, ${levelName}`,
    totalMinutes: stages.reduce((n, s) => n + s.minutes, 0),
    stages,
  };
}

export type { SlotType };

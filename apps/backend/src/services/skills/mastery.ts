/* What a learner really knows, estimated from evidence, never from time spent or things read.
   Every level can be explained by the evidence behind it. Pure functions: easy to test and to argue with. */

export type EvidenceType = 'read' | 'step' | 'review' | 'quiz' | 'explained' | 'exercise' | 'project';
export type Level = 'unseen' | 'exploring' | 'learning' | 'understood' | 'applied';

export interface Evidence { type: EvidenceType; /** 0 (failed) to 1 (fully right). */ outcome: number; at: Date; ref?: string | null }

/** How much each kind of evidence counts. Exposure counts for little, demonstration for a lot, real work the most. */
export const WEIGHT: Record<EvidenceType, number> = { read: 0.15, step: 0.3, review: 0.6, quiz: 0.8, explained: 1.0, exercise: 1.0, project: 1.2 };

/** Evidence that shows understanding, as opposed to having been exposed to something. */
export const DEMONSTRATES: EvidenceType[] = ['quiz', 'review', 'explained', 'exercise', 'project'];
/** Evidence that shows the learner used it, not only knew it. */
export const APPLIES: EvidenceType[] = ['exercise', 'project'];

const HALF_LIFE_DAYS = 120;
const PRIOR = 1; // a little doubt, so one lucky answer is not mastery
export const UNDERSTOOD_MASTERY = 0.55;
export const GOOD = 0.6; // an outcome at or above this counts as shown

const DAY = 86_400_000;
const decay = (at: Date, now: Date) => Math.pow(0.5, Math.max(0, now.getTime() - at.getTime()) / DAY / HALF_LIFE_DAYS);

export interface Estimate {
  level: Level;
  /** 0 to 1: how likely they know it, given the evidence and its age. */
  mastery: number;
  /** 0 to 1: how much evidence there is, whatever it says. Low confidence means "we do not know yet". */
  confidence: number;
  counts: Partial<Record<EvidenceType, number>>;
  lastAt: Date | null;
  trend: 'up' | 'flat' | 'down' | null;
  /** The sentences that justify the level, shown to the learner. */
  reasons: string[];
}

function score(evidence: Evidence[], now: Date) {
  let sum = 0;
  let support = 0;
  for (const e of evidence) {
    const w = WEIGHT[e.type] * decay(e.at, now);
    sum += w * Math.max(0, Math.min(1, e.outcome));
    support += w;
  }
  return { mastery: sum / (support + PRIOR), support };
}

export function estimate(all: Evidence[], now = new Date()): Estimate {
  const counts: Partial<Record<EvidenceType, number>> = {};
  for (const e of all) counts[e.type] = (counts[e.type] ?? 0) + 1;
  if (all.length === 0) return { level: 'unseen', mastery: 0, confidence: 0, counts, lastAt: null, trend: null, reasons: ['No evidence yet.'] };

  const { mastery, support } = score(all, now);
  const confidence = 1 - Math.exp(-support / 2);
  const lastAt = all.reduce((m, e) => (e.at > m ? e.at : m), all[0]!.at);

  const shown = all.filter((e) => DEMONSTRATES.includes(e.type) && e.outcome >= GOOD);
  const shownWeight = shown.reduce((n, e) => n + WEIGHT[e.type] * decay(e.at, now), 0);
  const applied = shown.some((e) => APPLIES.includes(e.type));
  const attempted = all.some((e) => DEMONSTRATES.includes(e.type));

  const reasons: string[] = [];
  let level: Level;
  if (!attempted) {
    level = 'exploring';
    reasons.push('You have gone through material on it, but nothing has shown yet that you understood it. Reading is not mastery: take a quiz or explain it.');
  } else if (mastery >= UNDERSTOOD_MASTERY && shownWeight >= 1.2) {
    level = applied ? 'applied' : 'understood';
    reasons.push(applied ? 'You have shown you understand it and used it in an exercise or a project.' : 'You have shown you understand it. Using it in an exercise or a project would make it "applied".');
  } else {
    level = 'learning';
    reasons.push(shown.length === 0 ? 'Your attempts so far did not show understanding yet.' : 'Some evidence of understanding, but not enough yet (or it is getting old).');
  }
  if (confidence < 0.4) reasons.push('Little evidence so far: this estimate may change a lot.');
  const age = (now.getTime() - lastAt.getTime()) / DAY;
  if (level !== 'exploring' && age > 60) reasons.push('Your last evidence is more than two months old: a review would confirm it.');

  // Direction: how the estimate compares with a month ago.
  let trend: Estimate['trend'] = null;
  const before = all.filter((e) => e.at.getTime() <= now.getTime() - 30 * DAY);
  if (before.length > 0 && before.length < all.length) {
    const delta = mastery - score(before, new Date(now.getTime() - 30 * DAY)).mastery;
    trend = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
  }
  return { level, mastery: Math.round(mastery * 100) / 100, confidence: Math.round(confidence * 100) / 100, counts, lastAt, trend, reasons };
}

export const LEVEL_ORDER: Level[] = ['unseen', 'exploring', 'learning', 'understood', 'applied'];
export const atLeast = (level: Level, min: Level) => LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);

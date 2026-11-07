/* SM-2 scheduling for cards the learner wrote. Four honest grades: forgot it, hard, good, easy. */

export type Grade = 0 | 1 | 2 | 3;
export interface CardState { ease: number; intervalDays: number; reps: number; lapses: number }

const DAY = 86_400_000;
export const MIN_EASE = 1.3;

export function schedule(card: CardState, grade: Grade, now = new Date()): CardState & { dueAt: Date } {
  if (grade === 0) {
    // Forgotten: start over, come back in ten minutes (the same session), and become a little harder to schedule.
    return { ease: Math.max(MIN_EASE, card.ease - 0.2), intervalDays: 0, reps: 0, lapses: card.lapses + 1, dueAt: new Date(now.getTime() + 10 * 60_000) };
  }
  const q = grade === 1 ? 3 : grade === 2 ? 4 : 5;
  const ease = Math.max(MIN_EASE, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const reps = card.reps + 1;
  let interval: number;
  if (reps === 1) interval = grade === 3 ? 4 : 1;
  else if (reps === 2) interval = grade === 3 ? 8 : 6;
  else interval = Math.round(card.intervalDays * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));
  interval = Math.max(1, interval);
  return { ease, intervalDays: interval, reps, lapses: card.lapses, dueAt: new Date(now.getTime() + interval * DAY) };
}

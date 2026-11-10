/* Streaks and the week in review. Dates are the learner's own calendar days ("YYYY-MM-DD"), worked out by the caller. */

const DAY = 86_400_000;
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => toDay(new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY));

export interface Streak { current: number; best: number; /** The last seven days up to today, oldest first. */ week: Array<{ date: string; active: boolean }>; todayDone: boolean }

/**
 * A streak is consecutive days with some learning. Today does not break it: the streak is still alive
 * until the day is over, so a learner who has not studied yet today keeps yesterday's count.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): Streak {
  const days = new Set(activeDays);
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) (current++, (cursor = addDays(cursor, -1)));

  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), week: Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6); return { date, active: days.has(date) }; }), todayDone: days.has(today) };
}

/** The learner's local day for an instant, given Date.getTimezoneOffset() (minutes, UTC minus local). */
export const localDay = (instant: Date, tzOffset: number) => toDay(new Date(instant.getTime() - tzOffset * 60_000));

/** Monday of the week a day belongs to. */
export function weekStart(day: string): string {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

/** What was done this week, against the time the learner said they have. */
export function weeklyGoal(minutesDone: number, hoursPerWeek: number) {
  const target = Math.max(30, Math.round(hoursPerWeek * 60));
  return { target, done: minutesDone, percent: Math.min(100, Math.round((minutesDone / target) * 100)), reached: minutesDone >= target };
}

/** Class totals are only shared when enough students are in them. */
export function classChallenge(thisWeekMinutes: number[], lastWeekMinutes: number[], minimum = 5) {
  if (thisWeekMinutes.length < minimum) return null;
  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  const now = sum(thisWeekMinutes);
  const before = sum(lastWeekMinutes);
  return {
    students: thisWeekMinutes.length,
    hours: Math.round(now / 6) / 10,
    changePercent: before > 0 ? Math.round(((now - before) / before) * 100) : null,
    reachedGoal: thisWeekMinutes.filter((m) => m >= 120).length >= minimum ? thisWeekMinutes.filter((m) => m >= 120).length : null,
  };
}

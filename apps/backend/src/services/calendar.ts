/** Pure calendar logic: planning study sessions and exporting to iCalendar. */

export interface PlanStep { id: string; contentId: string; title: string; minutes: number }
export interface PlannedSession { title: string; startsAt: Date; endsAt: Date; stepId: string; contentId: string }

export interface PlanOptions {
  /** Minutes the learner can give each week (hoursPerWeek * 60). */
  weeklyMinutes: number;
  /** Local hour a session starts at, 0-23. */
  startHour: number;
  /** Date.getTimezoneOffset() of the learner's browser (minutes, UTC minus local). */
  tzOffset: number;
  /** Days of the week used, 0 = Sunday ... 6 = Saturday. */
  days: number[];
  weeks: number;
  from: Date;
  /** A session never runs longer than this; longer steps are spread over several. */
  maxSessionMinutes?: number;
}

const MIN = 60_000;

/**
 * Lays the path's remaining steps out on the calendar: no more than the weekly time
 * the learner has, on the days they chose, one block per day, starting tomorrow.
 */
export function planSessions(steps: PlanStep[], opts: PlanOptions): PlannedSession[] {
  const maxSession = opts.maxSessionMinutes ?? 90;
  const days = [...new Set(opts.days)].filter((d) => d >= 0 && d <= 6).sort();
  if (steps.length === 0 || days.length === 0 || opts.weeklyMinutes < 15) return [];

  // Work in the learner's local time by shifting UTC with the offset.
  const toLocal = (d: Date) => new Date(d.getTime() - opts.tzOffset * MIN);
  const fromLocal = (d: Date) => new Date(d.getTime() + opts.tzOffset * MIN);

  const out: PlannedSession[] = [];
  const queue = steps.map((s) => ({ ...s, left: Math.max(5, s.minutes) }));
  let cursor = toLocal(opts.from);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1)); // tomorrow, local midnight
  const perDay = Math.max(15, Math.min(maxSession, Math.ceil(opts.weeklyMinutes / days.length)));

  let weekStart = -1;
  let usedThisWeek = 0;
  for (let i = 0; i < opts.weeks * 7 && queue.length > 0; i++) {
    const day = new Date(cursor.getTime() + i * 86_400_000);
    if (day.getUTCDay() === 1 || weekStart === -1) {
      weekStart = i;
      usedThisWeek = 0;
    }
    if (!days.includes(day.getUTCDay())) continue;

    let room = Math.min(perDay, opts.weeklyMinutes - usedThisWeek);
    if (room < 15) continue;
    let offset = 0;
    while (room >= 15 && queue.length > 0) {
      const step = queue[0]!;
      const take = Math.min(step.left, room);
      const startsLocal = new Date(day.getTime() + opts.startHour * 60 * MIN + offset * MIN);
      out.push({
        title: step.title,
        startsAt: fromLocal(startsLocal),
        endsAt: fromLocal(new Date(startsLocal.getTime() + take * MIN)),
        stepId: step.id,
        contentId: step.contentId,
      });
      step.left -= take;
      room -= take;
      offset += take;
      usedThisWeek += take;
      if (step.left < 10) queue.shift();
    }
  }
  return out;
}

export interface IcsEvent { id: string; title: string; kind: string; startsAt: Date; endsAt: Date; notes: string | null }

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 lines are folded at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TechTalk//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:TechTalk'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@techtalk`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(e.endsAt)}`,
      `SUMMARY:${icsText(e.title)}`,
      `CATEGORIES:${icsText(e.kind)}`,
      ...(e.notes ? [`DESCRIPTION:${icsText(e.notes)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

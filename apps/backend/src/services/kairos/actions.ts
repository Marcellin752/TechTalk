import { parseEvent } from '../../controllers/calendar.controller.js';

/* Kairos can PROPOSE things: add a session to the calendar, plan the week, rebuild a path, open the review.
   It never does them: the learner confirms with a button, and the app then calls the usual, checked endpoints.
   A model that has been talked into something can therefore never change anything on its own. */

export type KairosAction =
  | { type: 'calendar.add'; title: string; kind: 'study' | 'school' | 'deadline' | 'event'; startsAt: string; endsAt: string; notes?: string | null }
  | { type: 'plan.sessions' }
  | { type: 'path.rebuild' }
  | { type: 'review.open' };

export const MAX_ACTIONS = 2;
export const MAX_NOTES = 20;
export const NOTE_LENGTH = 160;

export interface Parsed { text: string; actions: KairosAction[]; notes: string[] }

function validate(raw: unknown): KairosAction | null {
  const a = raw as Record<string, unknown> | null;
  switch (a?.type) {
    case 'plan.sessions': case 'path.rebuild': case 'review.open':
      return { type: a.type };
    case 'calendar.add': {
      const r = parseEvent({ title: a.title, kind: a.kind ?? 'study', startsAt: a.startsAt, endsAt: a.endsAt, notes: a.notes }, false);
      if (!r.ok) return null;
      const v = r.values as { title: string; kind: 'study' | 'school' | 'deadline' | 'event'; startsAt: Date; endsAt: Date; notes?: string | null };
      // A proposal in the past or lasting a day is a mistake of the model: drop it rather than show it.
      if (v.endsAt <= v.startsAt || v.startsAt.getTime() < Date.now() - 3_600_000 || v.endsAt.getTime() - v.startsAt.getTime() > 12 * 3_600_000) return null;
      return { type: 'calendar.add', title: v.title, kind: v.kind, startsAt: v.startsAt.toISOString(), endsAt: v.endsAt.toISOString(), notes: v.notes ?? null };
    }
    default:
      return null;
  }
}

/**
 * Splits the reply into the text, the proposed actions ("@@ACTION {json}") and the notes Kairos wants to
 * remember ("@@NOTE short sentence"). These lines are removed from what the learner reads.
 */
export function splitDirectives(raw: string): Parsed {
  const actions: KairosAction[] = [];
  const notes: string[] = [];
  const kept: string[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t.startsWith('@@ACTION')) {
      try {
        const a = validate(JSON.parse(t.slice(8).trim()));
        if (a && actions.length < MAX_ACTIONS && !actions.some((x) => JSON.stringify(x) === JSON.stringify(a))) actions.push(a);
      } catch {
        /* a malformed directive is simply not shown */
      }
    } else if (t.startsWith('@@NOTE')) {
      const note = t.slice(6).replace(/\s+/g, ' ').trim().slice(0, NOTE_LENGTH);
      if (note.length >= 8 && notes.length < 2) notes.push(note);
    } else kept.push(line);
  }
  return { text: kept.join('\n').trim(), actions, notes };
}

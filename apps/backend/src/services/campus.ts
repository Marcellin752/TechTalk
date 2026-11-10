import { cleanTopics } from './learning/school.js';

/* Pure rules of the campus module: what may be shared, and how people are matched. */

export const RESOURCE_KINDS = ['exam', 'correction', 'td', 'notes', 'cheatsheet'] as const;
export const LOOKING_FOR = ['study-buddy', 'mentor', 'mentee', 'team'] as const;
/** Reports that hide a shared resource until an administrator looks at it. */
export const AUTO_HIDE_REPORTS = 3;

/** http(s) only, with a real host: no javascript:, no file:, no local or private addresses. */
export function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // an IP address, public or not, is not a shared resource
  if (host.startsWith('[')) return false;
  return true;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ResourceInput { title: string; kind: (typeof RESOURCE_KINDS)[number]; subject: string; year: number | null; studyYear: number | null; url: string; description: string | null }

export function parseResource(raw: unknown, now = new Date()): Result<ResourceInput> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = clean(b.title, 140);
  if (title.length < 3) return { ok: false, error: 'Give it a title (3 characters or more).' };
  if (!RESOURCE_KINDS.includes(b.kind as never)) return { ok: false, error: 'Choose what it is: exam, correction, td, notes or cheatsheet.' };
  const subject = clean(b.subject, 80);
  if (subject.length < 1) return { ok: false, error: 'Say which subject it is for.' };
  if (!isSafeUrl(b.url)) return { ok: false, error: 'The link must be a public http(s) address.' };
  const year = b.year == null || b.year === '' ? null : Number(b.year);
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > now.getFullYear() + 1)) return { ok: false, error: 'The exam year is not valid.' };
  const studyYear = b.studyYear == null || b.studyYear === '' ? null : Number(b.studyYear);
  if (studyYear !== null && (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 8)) return { ok: false, error: 'The study year must be between 1 and 8.' };
  const description = clean(b.description, 500) || null;
  return { ok: true, value: { title, kind: b.kind as ResourceInput['kind'], subject, year, studyYear, url: b.url, description } };
}

export interface SessionInput { title: string; subject: string; description: string | null; startsAt: Date; endsAt: Date; place: string | null; onlineUrl: string | null; capacity: number }

export function parseSession(raw: unknown, now = new Date()): Result<SessionInput> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = clean(b.title, 120);
  if (title.length < 3) return { ok: false, error: 'Give the session a title (3 characters or more).' };
  const subject = clean(b.subject, 80);
  if (subject.length < 1) return { ok: false, error: 'Say which subject you will revise.' };
  const startsAt = new Date(String(b.startsAt));
  const endsAt = new Date(String(b.endsAt));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: 'Pick a start and an end time.' };
  if (startsAt.getTime() < now.getTime() - 5 * 60_000) return { ok: false, error: 'A session cannot start in the past.' };
  if (endsAt <= startsAt) return { ok: false, error: 'The end must come after the start.' };
  if (endsAt.getTime() - startsAt.getTime() > 12 * 3_600_000) return { ok: false, error: 'A session lasts 12 hours at most.' };
  if (startsAt.getTime() > now.getTime() + 120 * 86_400_000) return { ok: false, error: 'Plan at most 4 months ahead.' };
  const place = clean(b.place, 120) || null;
  const onlineUrl = b.onlineUrl == null || b.onlineUrl === '' ? null : b.onlineUrl;
  if (onlineUrl !== null && !isSafeUrl(onlineUrl)) return { ok: false, error: 'The online link must be a public http(s) address.' };
  if (!place && !onlineUrl) return { ok: false, error: 'Say where it takes place: a room or an online link.' };
  const capacity = b.capacity == null || b.capacity === '' ? 8 : Number(b.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 50) return { ok: false, error: 'Places must be between 2 and 50.' };
  return { ok: true, value: { title, subject, description: clean(b.description, 500) || null, startsAt, endsAt, place, onlineUrl: onlineUrl as string | null, capacity } };
}

export interface CampusProfileInput { discoverable: boolean; headline: string | null; lookingFor: (typeof LOOKING_FOR)[number] | null; contact: string | null }

export function parseCampusProfile(raw: unknown): Result<Partial<CampusProfileInput>> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<CampusProfileInput> = {};
  if (b.discoverable !== undefined) {
    if (typeof b.discoverable !== 'boolean') return { ok: false, error: 'discoverable must be true or false.' };
    out.discoverable = b.discoverable;
  }
  if (b.headline !== undefined) out.headline = clean(b.headline, 120) || null;
  if (b.lookingFor !== undefined) {
    if (b.lookingFor !== null && !LOOKING_FOR.includes(b.lookingFor as never)) return { ok: false, error: 'lookingFor is not one of the allowed values.' };
    out.lookingFor = b.lookingFor as CampusProfileInput['lookingFor'];
  }
  if (b.contact !== undefined) {
    const contact = clean(b.contact, 60);
    if (contact && !/^[\w@.#+\-/: ]+$/u.test(contact)) return { ok: false, error: 'The contact can contain letters, digits and @ . # + - only.' };
    if (/https?:\/\//i.test(contact)) return { ok: false, error: 'Give a handle, not a link.' };
    out.contact = contact || null;
  }
  return { ok: true, value: out };
}

export const sharedTopics = (a: string[], b: string[]) => {
  const set = new Set(cleanTopics(a, 50));
  return cleanTopics(b, 50).filter((t) => set.has(t));
};

export interface Person { userId: string; year: number | null; topics: string[]; lookingFor: string | null }

/** Best matches first: shared topics count most, then the same year, then looking for the same thing. */
export function rankPeople<T extends Person>(me: { year: number | null; topics: string[]; lookingFor: string | null }, others: T[]): Array<T & { shared: string[]; score: number }> {
  return others
    .map((o) => {
      const shared = sharedTopics(me.topics, o.topics);
      const score = shared.length * 3 + (me.year != null && o.year === me.year ? 2 : 0) + (me.lookingFor && o.lookingFor && me.lookingFor === o.lookingFor ? 1 : 0);
      return { ...o, shared, score };
    })
    .sort((a, b) => b.score - a.score);
}

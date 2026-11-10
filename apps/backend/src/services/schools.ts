import { createHash, randomBytes } from 'node:crypto';
import { cleanTopics, SCHOOL_PRESETS } from './learning/school.js';
import type { Programme, SchoolCurriculum } from '../db/schema.js';
import { EPITECH_PROGRAMME } from './learning/epitech.js';

/* Everything about schools that needs no database: keys, validation, and the
   privacy rule for statistics. */

export const API_KEY_PREFIX = 'ttk_';
export const MIN_COHORT = 5; // never report on fewer learners than this
export const KINDS = ['study', 'school', 'deadline', 'event'] as const;

export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** A new key: shown to the school once; only its hash is kept. */
export function generateApiKey() {
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) };
}

/** Pulls a key out of `X-API-Key` or `Authorization: Bearer ttk_...`. */
export function extractApiKey(headers: Record<string, unknown>): string | null {
  const direct = headers['x-api-key'];
  if (typeof direct === 'string' && direct.startsWith(API_KEY_PREFIX)) return direct.trim();
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ' + API_KEY_PREFIX)) return auth.slice(7).trim();
  return null;
}

export const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const PROJECT_KINDS = ['piscine', 'project', 'module', 'internship'] as const;

/** Validates a programme: years of projects, each with the topics it teaches. */
export function parseProgramme(input: unknown): { ok: true; programme: Programme } | { ok: false; error: string } {
  const b = (input ?? {}) as { status?: unknown; years?: unknown };
  if (!Array.isArray(b.years) || b.years.length === 0) return { ok: false, error: 'programme.years must be a list with one entry per year.' };
  if (b.years.length > 8) return { ok: false, error: 'At most 8 years.' };
  const seen = new Set<number>();
  const years: Programme['years'] = [];
  for (const [i, y] of (b.years as Array<Record<string, unknown>>).entries()) {
    const year = Number(y?.year);
    if (!Number.isInteger(year) || year < 1 || year > 8) return { ok: false, error: `programme.years[${i}].year must be between 1 and 8.` };
    if (seen.has(year)) return { ok: false, error: `Year ${year} appears twice.` };
    seen.add(year);
    const title = clip(y.title, 120);
    if (!title) return { ok: false, error: `programme.years[${i}] needs a title.` };
    if (!Array.isArray(y.projects) || y.projects.length === 0) return { ok: false, error: `programme.years[${i}].projects must list at least one project.` };
    if (y.projects.length > 30) return { ok: false, error: `programme.years[${i}]: at most 30 projects.` };
    const projects: Programme['years'][number]['projects'] = [];
    for (const [k, p] of (y.projects as Array<Record<string, unknown>>).entries()) {
      const name = clip(p?.name, 120);
      if (!name) return { ok: false, error: `programme.years[${i}].projects[${k}] needs a name.` };
      const topics = cleanTopics(p?.topics, 8);
      if (topics.length === 0) return { ok: false, error: `${name}: give at least one topic, they decide which resources are suggested.` };
      const kind = p?.kind === undefined ? undefined : p.kind;
      if (kind !== undefined && !PROJECT_KINDS.includes(kind as never)) return { ok: false, error: `${name}: kind must be piscine, project, module or internship.` };
      const hours = p?.hours === undefined ? undefined : Number(p.hours);
      if (hours !== undefined && (!Number.isFinite(hours) || hours < 1 || hours > 600)) return { ok: false, error: `${name}: hours must be between 1 and 600.` };
      const summary = clip(p?.summary, 300);
      projects.push({ name, topics, ...(summary ? { summary } : {}), ...(kind ? { kind: kind as (typeof PROJECT_KINDS)[number] } : {}), ...(hours ? { hours: Math.round(hours) } : {}) });
    }
    const summary = clip(y.summary, 300);
    years.push({ year, title, ...(summary ? { summary } : {}), projects });
  }
  years.sort((a, b) => a.year - b.year);
  const status = b.status === 'confirmed' ? 'confirmed' : 'draft';
  return { ok: true, programme: { status, years } };
}

/** The flat topic list per year (index 0 = year 1) that a programme implies. */
export function topicsFromProgramme(p: Programme): string[][] {
  const max = Math.max(...p.years.map((y) => y.year));
  return Array.from({ length: max }, (_, i) => [...new Set((p.years.find((y) => y.year === i + 1)?.projects ?? []).flatMap((pr) => pr.topics))].slice(0, 12));
}

/** Accepts the simple form ({years: topics}), a full {programme}, or both. */
export function parseCurriculum(input: unknown): { ok: true; curriculum: SchoolCurriculum } | { ok: false; error: string } {
  const b = (input ?? {}) as { years?: unknown; programme?: unknown };
  if (b.programme !== undefined) {
    const pr = parseProgramme(b.programme);
    if (!pr.ok) return pr;
    const simple = b.years === undefined ? null : parseSimpleCurriculum({ years: b.years });
    if (simple && !simple.ok) return simple;
    return { ok: true, curriculum: { years: simple?.ok ? simple.curriculum.years : topicsFromProgramme(pr.programme), programme: pr.programme } };
  }
  return parseSimpleCurriculum(input);
}

function parseSimpleCurriculum(input: unknown): { ok: true; curriculum: SchoolCurriculum } | { ok: false; error: string } {
  const raw = (input as { years?: unknown } | null)?.years;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'years must be a list with one entry per year.' };
  if (raw.length > 8) return { ok: false, error: 'At most 8 years.' };
  const years = raw.map((y) => cleanTopics(y, 12));
  if (years.every((y) => y.length === 0)) return { ok: false, error: 'Give at least one topic.' };
  return { ok: true, curriculum: { years } };
}

export interface SchoolEventInput {
  externalId: string; title: string; kind: (typeof KINDS)[number]; startsAt: Date; endsAt: Date; notes: string | null; year: number | null;
}

export function parseSchoolEvent(raw: unknown): { ok: true; event: SchoolEventInput } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const externalId = typeof b.externalId === 'string' ? b.externalId.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(externalId)) return { ok: false, error: 'externalId must be 1-100 characters: letters, digits, . _ : -' };
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 160) return { ok: false, error: 'title is required (160 characters max).' };
  if (!KINDS.includes(b.kind as never)) return { ok: false, error: 'kind must be study, school, deadline or event.' };
  const startsAt = new Date(String(b.startsAt));
  const endsAt = new Date(String(b.endsAt));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: 'startsAt and endsAt must be ISO 8601 dates.' };
  if (endsAt <= startsAt) return { ok: false, error: 'endsAt must be after startsAt.' };
  if (endsAt.getTime() - startsAt.getTime() > 14 * 86_400_000) return { ok: false, error: 'An event cannot last more than 14 days.' };
  if (b.notes != null && (typeof b.notes !== 'string' || b.notes.length > 500)) return { ok: false, error: 'notes: 500 characters max.' };
  const year = b.year == null ? null : Number(b.year);
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 8)) return { ok: false, error: 'year must be between 1 and 8, or omitted.' };
  return { ok: true, event: { externalId, title, kind: b.kind as SchoolEventInput['kind'], startsAt, endsAt, notes: typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null, year } };
}

/** The static presets, as curricula, for schools that have none stored (Epitech first). */
export function presetCurriculum(slug: string): SchoolCurriculum | null {
  if (slug === 'epitech') return { years: topicsFromProgramme(EPITECH_PROGRAMME), programme: EPITECH_PROGRAMME };
  const preset = SCHOOL_PRESETS.find((p) => p.id === slug);
  return preset ? { years: preset.years } : null;
}

export interface LearnerRow { year: number | null; goal: string; level: string; percent: number }

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/**
 * Group statistics for a school. Small groups identify people, so: fewer than MIN_COHORT
 * learners in total reports nothing but the fact; any breakdown row below the minimum is dropped.
 */
export function aggregateCohort(rows: LearnerRow[], k = MIN_COHORT) {
  if (rows.length < k) return { learners: null as number | null, suppressed: true, minimumGroupSize: k };
  const years = new Map<number, number[]>();
  const goals = new Map<string, number>();
  const levels = new Map<string, number>();
  for (const r of rows) {
    if (r.year != null) years.set(r.year, [...(years.get(r.year) ?? []), r.percent]);
    bump(goals, r.goal);
    bump(levels, r.level);
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const keep = <T extends { n: number }>(xs: T[]) => xs.filter((x) => x.n >= k).sort((a, b) => b.n - a.n);
  return {
    learners: rows.length,
    suppressed: false,
    minimumGroupSize: k,
    averageProgressPercent: avg(rows.map((r) => r.percent)),
    byYear: keep([...years].map(([year, ps]) => ({ year, n: ps.length, averageProgressPercent: avg(ps) }))).sort((a, b) => a.year - b.year),
    goals: keep([...goals].map(([goal, n]) => ({ goal, n }))),
    levels: keep([...levels].map(([level, n]) => ({ level, n }))),
  };
}

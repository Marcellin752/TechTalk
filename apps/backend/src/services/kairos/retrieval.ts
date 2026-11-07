import { and, asc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { calendarEvents, contents, learningPaths, learningProfiles, learningSteps, githubProfiles, users } from '../../db/schema.js';
import type { CatalogHit, LearnerContext } from './prompt.js';

/* What Kairos knows about the question (matching catalogue items) and about the
   learner (profile, path, languages). Retrieval is plain keyword search: it is
   predictable, free, and good enough over a catalogue of a thousand items. */

const STOPWORDS = new Set((
  'the a an and or of to in on for with is are was be it this that how what why when which do does can could would should my me i you your we they ' +
  'le la les un une des du de et ou en pour avec est sont quoi comment pourquoi quand quel quelle quels quelles que qui je tu il elle nous vous ils ' +
  'mon ma mes ton ta tes son sa ses ce cette ces dans sur par pas ne plus au aux veux voudrais peux peut faire fait aide aider explique expliquer ' +
  'donne donner moi tout tous très trop juste comme si mais où donc car être avoir'
).split(' '));

export function extractKeywords(text: string, max = 6): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length >= 3 || /^(c\+\+|c#|go|r|ai|ml|js|ts)$/.test(w))
    .filter((w) => !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, max);
}

interface Row { id: string; type: string; title: string; url: string; source: string; summary: string | null; meta: Record<string, unknown> | null }

const TYPE_BONUS: Record<string, number> = { course: 0.6, roadmap: 0.5, doc: 0.4, exercise: 0.3, question: 0.2, video: 0.3, paper: 0, repo: 0.1 };

/** Scores rows by how many keywords hit the title (strong) or summary; best first, varied by type. */
export function rankRows(rows: Row[], keywords: string[], limit = 6): Row[] {
  const scored = rows
    .map((r) => {
      const title = r.title.toLowerCase();
      const summary = (r.summary ?? '').toLowerCase();
      let score = 0;
      for (const k of keywords) {
        if (title.includes(k)) score += 3;
        if (summary.includes(k)) score += 1;
      }
      return { r, score: score > 0 ? score + (TYPE_BONUS[r.type] ?? 0) : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  // No more than two of a kind, so the answer can point at a course, a doc and an exercise.
  const perType = new Map<string, number>();
  const out: Row[] = [];
  for (const { r } of scored) {
    if ((perType.get(r.type) ?? 0) >= 2) continue;
    perType.set(r.type, (perType.get(r.type) ?? 0) + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

const LEARN_TYPES = ['roadmap', 'course', 'video', 'doc', 'exercise', 'question', 'paper', 'repo'];

export async function searchCatalog(question: string): Promise<CatalogHit[]> {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];
  const rows = (await db
    .select({ id: contents.id, type: contents.type, title: contents.title, url: contents.url, source: contents.source, summary: contents.summary, meta: contents.meta })
    .from(contents)
    .where(and(
      inArray(contents.type, LEARN_TYPES),
      sql`(${contents.type} <> 'video' or ${contents.meta}->>'learn' = 'true')`,
      or(...keywords.flatMap((k) => [ilike(contents.title, `%${k}%`), ilike(contents.summary, `%${k}%`)])),
    ))
    .limit(150)) as Row[];
  return rankRows(rows, keywords).map((r, i) => ({ n: i + 1, id: r.id, type: r.type, title: r.title, url: r.url, source: r.source, summary: r.summary ?? '' }));
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon 2030-01-07 17:00 UTC, in 2 days": the weekday and the distance stop the model guessing "today". */
export function describeWhen(at: Date, now: Date): string {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(at) - day(now)) / 86_400_000);
  const rel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
  return `${DAYS[at.getUTCDay()]} ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC, ${rel}`;
}

export async function loadLearnerContext(userId: string): Promise<LearnerContext> {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, userId)).limit(1);
  const [gh] = await db.select({ languages: githubProfiles.languages }).from(githubProfiles).where(eq(githubProfiles.userId, userId)).limit(1);
  const ctx: LearnerContext = {
    name: user?.name ?? 'learner',
    goal: profile?.goal,
    level: profile?.level,
    languages: profile?.languages,
    hoursPerWeek: profile?.hoursPerWeek,
    style: profile?.style,
    githubLanguages: gh?.languages?.slice(0, 4).map((l) => l.name),
    school: profile?.school ? { name: profile.school, year: profile.schoolYear, topics: profile.schoolTopics ?? [] } : null,
    path: null,
  };

  const now = new Date();
  const soon = await db
    .select({ title: calendarEvents.title, kind: calendarEvents.kind, startsAt: calendarEvents.startsAt })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.done, false), gte(calendarEvents.startsAt, now), lt(calendarEvents.startsAt, new Date(now.getTime() + 7 * 86_400_000))))
    .orderBy(asc(calendarEvents.startsAt))
    .limit(5);
  ctx.upcoming = soon.map((e) => ({ title: e.title, kind: e.kind, when: describeWhen(e.startsAt, now) }));

  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.userId, userId), eq(learningPaths.active, true))).limit(1);
  if (path) {
    const steps = await db
      .select({ status: learningSteps.status, stage: learningSteps.stage, title: contents.title })
      .from(learningSteps)
      .innerJoin(contents, eq(contents.id, learningSteps.contentId))
      .where(eq(learningSteps.pathId, path.id))
      .orderBy(asc(learningSteps.position));
    const done = steps.filter((s) => s.status === 'done').length;
    const next = steps.find((s) => s.status === 'doing') ?? steps.find((s) => s.status !== 'done');
    ctx.path = {
      title: path.title,
      percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
      stepsDone: done,
      stepsTotal: steps.length,
      stage: next ? path.stages.find((s) => s.index === next.stage)?.title : undefined,
      nextStep: next?.title,
    };
  }
  return ctx;
}


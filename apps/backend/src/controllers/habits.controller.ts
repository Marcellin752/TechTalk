import { FastifyRequest, FastifyReply } from 'fastify';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, githubProfiles, learningPaths, learningProfiles, learningQuizzes, learningSteps, reviewItems, schoolEvents } from '../db/schema.js';
import { classChallenge, computeStreak, localDay, weekStart, weeklyGoal } from '../services/learning/habits.js';
import { rankOpportunities } from '../services/learning/opportunities.js';
import { MIN_COHORT } from '../services/schools.js';
import { backfill, loadGraph } from '../services/skills/store.js';
import { pathView } from '../services/learning/paths-store.js';

const userId = (r: FastifyRequest) => (r.user as { id: string }).id;
export const tzOf = (q: { tz?: string }) => {
  const n = Number(q.tz);
  return Number.isFinite(n) ? Math.max(-840, Math.min(840, Math.round(n))) : 0;
};
const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};

/** Every local day on which the learner finished a step, answered a review or took a quiz. */
export async function activeDays(uid: string, tz: number): Promise<string[]> {
  // Raw SQL here takes dates as ISO text: the driver does not accept Date objects in this form.
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const rows = Array.from(
    (await db.execute(sql`
      select distinct to_char(t - (${tz} * interval '1 minute'), 'YYYY-MM-DD') as day from (
        select completed_at as t from learning_steps where user_id = ${uid} and completed_at is not null and completed_at > ${since}::timestamptz
        union all select last_at from review_items where user_id = ${uid} and last_at is not null and last_at > ${since}::timestamptz
        union all select last_attempt_at from learning_quizzes where user_id = ${uid} and last_attempt_at is not null and last_attempt_at > ${since}::timestamptz
      ) x
    `)) as unknown as Array<{ day: string }>,
  );
  return rows.map((r) => r.day);
}

/** The week in review: streak, time against the goal, what was done, and how the class is doing (if the learner shares). */
export async function handleWeek(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const tz = tzOf(request.query as { tz?: string });
    const today = localDay(new Date(), tz);
    const monday = weekStart(today);
    const startInstant = new Date(Date.parse(`${monday}T00:00:00Z`) + tz * 60_000);

    const [days, [lp]] = await Promise.all([activeDays(uid, tz), db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1)]);
    const streak = computeStreak(days, today);

    const [steps] = await db
      .select({ n: sql<number>`count(*)::int`, minutes: sql<number>`coalesce(sum(${learningSteps.minutes}), 0)::int` })
      .from(learningSteps)
      .where(and(eq(learningSteps.userId, uid), gte(learningSteps.completedAt, startInstant)));
    const [reviews] = await db.select({ n: sql<number>`count(*)::int` }).from(reviewItems).where(and(eq(reviewItems.userId, uid), gte(reviewItems.lastAt, startInstant)));
    const [quizzes] = await db.select({ n: sql<number>`count(*)::int` }).from(learningQuizzes).where(and(eq(learningQuizzes.userId, uid), gte(learningQuizzes.passedAt, startInstant)));
    const [due] = await db.select({ n: sql<number>`count(*)::int` }).from(reviewItems).where(and(eq(reviewItems.userId, uid), lt(reviewItems.dueAt, new Date())));

    let challenge = null;
    if (lp?.schoolId && lp.shareWithSchool) {
      const prev = new Date(startInstant.getTime() - 7 * 86_400_000).toISOString();
      const startIso = startInstant.toISOString();
      const rows = Array.from(
        (await db.execute(sql`
          select lp.user_id,
                 coalesce(sum(ls.minutes) filter (where ls.completed_at >= ${startIso}::timestamptz), 0)::int as this_week,
                 coalesce(sum(ls.minutes) filter (where ls.completed_at >= ${prev}::timestamptz and ls.completed_at < ${startIso}::timestamptz), 0)::int as last_week
          from learning_profiles lp
          left join learning_steps ls on ls.user_id = lp.user_id and ls.completed_at >= ${prev}::timestamptz
          where lp.school_id = ${lp.schoolId} and lp.share_with_school
          group by lp.user_id
        `)) as unknown as Array<{ this_week: number; last_week: number }>,
      );
      challenge = classChallenge(rows.map((r) => r.this_week), rows.map((r) => r.last_week), MIN_COHORT);
    }

    return reply.status(200).send({
      streak,
      goal: weeklyGoal(steps?.minutes ?? 0, lp?.hoursPerWeek ?? 5),
      week: { steps: steps?.n ?? 0, reviews: reviews?.n ?? 0, quizzesPassed: quizzes?.n ?? 0 },
      reviewsDue: due?.n ?? 0,
      challenge,
      // The learner is shown the week in full on Sundays.
      isSunday: new Date(Date.parse(`${today}T00:00:00Z`)).getUTCDay() === 0,
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** The parts of a stage's title that can name a deadline: "my_ls and my_printf" is both "my ls" and "my printf". */
export function titleKeys(stageTitle: string): string[] {
  // "Piscine: C and Unix pool" is also "Piscine" (before the colon), and "my_ls and my_printf" is both of its parts.
  const beforeColon = stageTitle.includes(':') ? [norm(stageTitle.split(':')[0]!)] : [];
  return [...new Set([norm(stageTitle), ...beforeColon, ...stageTitle.split(/\s+and\s+|,|\//i).map(norm)])].filter((k) => k.length >= 4);
}

/** Whether a school event (an exam, a project deadline) is about a stage of the learner's school path. */
export function eventMatchesStage(eventTitle: string, stageTitle: string): boolean {
  const e = norm(eventTitle);
  return titleKeys(stageTitle).some((k) => e.includes(k));
}

/**
 * What is coming up at school and what to review for it: each deadline from the school, matched to the
 * stage of the learner's school path that prepares for it, with the steps still to do there.
 */
export async function handleUpcoming(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [lp] = await db.select({ schoolId: learningProfiles.schoolId, year: learningProfiles.schoolYear }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    if (!lp?.schoolId) return reply.status(200).send({ items: [] });

    const now = new Date();
    const events = await db
      .select({ id: schoolEvents.id, title: schoolEvents.title, kind: schoolEvents.kind, startsAt: schoolEvents.startsAt, year: schoolEvents.year })
      .from(schoolEvents)
      .where(and(eq(schoolEvents.schoolId, lp.schoolId), gte(schoolEvents.startsAt, now), lt(schoolEvents.startsAt, new Date(now.getTime() + 60 * 86_400_000))))
      .orderBy(schoolEvents.startsAt)
      .limit(40);
    const mine = events.filter((e) => e.year == null || e.year === lp.year);
    if (mine.length === 0) return reply.status(200).send({ items: [] });

    const schoolPaths = await db.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.kind, 'school')));
    const views = (await Promise.all(schoolPaths.map((p) => pathView(uid, p.id)))).filter((v): v is NonNullable<typeof v> => !!v);

    const items = mine.slice(0, 8).map((e) => {
      for (const v of views) {
        const stage = v.stages.find((s) => eventMatchesStage(e.title, s.title));
        if (stage) {
          return {
            event: { id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt },
            daysLeft: Math.max(0, Math.ceil((e.startsAt.getTime() - now.getTime()) / 86_400_000)),
            stage: { pathId: v.id, index: stage.index, title: stage.title, topics: stage.topics ?? [], done: stage.done, total: stage.total, checkpointPassed: stage.checkpoint.passed },
            todo: stage.steps.filter((s) => s.status !== 'done').slice(0, 4).map((s) => ({ id: s.id, title: s.content.title, type: s.content.type, url: s.content.url, minutes: s.minutes })),
          };
        }
      }
      return { event: { id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt }, daysLeft: Math.max(0, Math.ceil((e.startsAt.getTime() - now.getTime()) / 86_400_000)), stage: null, todo: [] };
    });
    return reply.status(200).send({ items });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Issues and jobs that match what the learner can do: their languages and the stages they have finished. */
export async function handleOpportunities(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [lp] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    const [gh] = await db.select({ languages: githubProfiles.languages }).from(githubProfiles).where(eq(githubProfiles.userId, uid)).limit(1);

    // Skills: languages they use or learn, and the topics of every stage they have completed or passed.
    const skills = new Set<string>([...(lp?.languages ?? []), ...(gh?.languages ?? []).map((l) => l.name), ...(lp?.schoolTopics ?? [])].map((s) => s.toLowerCase()));
    // What the learner has shown (understood or better) counts first; completing a stage still counts, as before.
    await backfill(uid);
    const g = await loadGraph(uid);
    for (const n of g.nodes) if (n.level === 'understood' || n.level === 'applied' || n.level === 'learning') { skills.add(n.name.toLowerCase()); skills.add(n.slug); }
    const paths = await db.select({ id: learningPaths.id }).from(learningPaths).where(eq(learningPaths.userId, uid));
    for (const p of paths) {
      const v = await pathView(uid, p.id);
      for (const st of v?.stages ?? []) if (st.complete || st.checkpoint.passed) for (const t of st.topics ?? []) skills.add(t.toLowerCase());
    }

    const rows = await db
      .select({ id: contents.id, title: contents.title, summary: contents.summary, url: contents.url, source: contents.source, meta: contents.meta, categories: contents.categories })
      .from(contents)
      .where(eq(contents.type, 'opportunity'))
      .orderBy(desc(contents.createdAt))
      .limit(500);
    const ranked = rankOpportunities(rows as never, [...skills], lp?.schoolYear).slice(0, 24);
    return reply.status(200).send({
      skills: [...skills].slice(0, 30),
      year: lp?.schoolYear ?? null,
      items: ranked.map((o) => ({
        id: o.id, title: o.title, summary: o.summary, url: o.url, source: o.source, kind: o.kind, internship: o.internship, matched: o.matched,
        company: o.meta?.company ?? null, location: o.meta?.location ?? null, repo: o.meta?.repo ?? null, labels: (o.meta?.labels ?? []).slice?.(0, 4) ?? [],
      })),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

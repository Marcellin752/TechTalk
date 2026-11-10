import { recordEvidence, recordStepEvidence } from '../services/skills/store.js';
import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, learningPaths, learningProfiles, learningQuizzes, learningSteps, reviewItems, type StoredQuestion } from '../db/schema.js';
import { generate, LlmUnavailableError, providerChain } from '../services/kairos/llm.js';
import { firstReview, gradeQuiz, nextReview, parseQuiz, publicQuestion, quizPrompt } from '../services/learning/quiz.js';
import { CODEWARS_USER, fetchSolved, matchSolved } from '../services/codewars.js';
import { pathView } from '../services/learning/paths-store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const userId = (r: FastifyRequest) => (r.user as { id: string }).id;
const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};

const quizView = (q: typeof learningQuizzes.$inferSelect) => ({
  quizId: q.id, questions: q.questions.map(publicQuestion), attempts: q.attempts, bestScore: q.bestScore, passed: !!q.passedAt,
});

async function makeQuestions(uid: string, pathId: string, stageIndex: number): Promise<StoredQuestion[] | { error: string; status: number }> {
  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
  if (!path) return { error: 'Path not found.', status: 404 };
  const stage = path.stages.find((s) => s.index === stageIndex);
  if (!stage) return { error: 'Stage not found.', status: 404 };
  const steps = await db
    .select({ status: learningSteps.status, title: contents.title, summary: contents.summary })
    .from(learningSteps)
    .innerJoin(contents, eq(contents.id, learningSteps.contentId))
    .where(and(eq(learningSteps.pathId, pathId), eq(learningSteps.stage, stageIndex)))
    .orderBy(asc(learningSteps.position));
  if (steps.length === 0 || steps.some((s) => s.status !== 'done')) return { error: 'Finish every step of this stage first.', status: 409 };
  if (providerChain().length === 0) return { error: 'Quizzes are written by Kairos, which is not configured on this server.', status: 503 };

  const { system, user } = quizPrompt(stage, steps, path.level);
  // The model sometimes returns something unusable, or a provider is rate-limited for a moment: a few tries before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await generate(system, [{ role: 'user', content: user }], { maxTokens: 1400, temperature: attempt === 0 ? 0.4 : 0.2 });
      const parsed = parseQuiz(r.text);
      if (parsed) return parsed;
      console.warn(`[quiz] unusable model output (attempt ${attempt + 1}, ${r.text.length} chars): ${r.text.slice(0, 160).replace(/\s+/g, ' ')}`);
    } catch (err) {
      if (err instanceof LlmUnavailableError) return { error: 'Kairos is catching its breath. Try again in a moment.', status: 503 };
      throw err;
    }
  }
  return { error: 'Kairos could not write a good quiz this time. Try again.', status: 503 };
}

/** The quiz for a finished stage: the one already made, or a new one written by Kairos. */
export async function handleGetQuiz(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id, index } = request.params as { id?: string; index?: string };
    const stage = Number(index);
    if (!id || !UUID_RE.test(id) || !Number.isInteger(stage) || stage < 0 || stage > 50) return reply.status(400).send({ error: 'Invalid path or stage.' });

    const [existing] = await db.select().from(learningQuizzes).where(and(eq(learningQuizzes.pathId, id), eq(learningQuizzes.stage, stage), eq(learningQuizzes.userId, uid))).limit(1);
    if (existing) return reply.status(200).send(quizView(existing));

    const questions = await makeQuestions(uid, id, stage);
    if (!Array.isArray(questions)) return reply.status(questions.status).send({ error: questions.error });
    const [row] = await db.insert(learningQuizzes).values({ userId: uid, pathId: id, stage, questions }).onConflictDoNothing().returning();
    const quiz = row ?? (await db.select().from(learningQuizzes).where(and(eq(learningQuizzes.pathId, id), eq(learningQuizzes.stage, stage))).limit(1))[0]!;
    return reply.status(200).send(quizView(quiz));
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** New questions for a stage, for a retake after a failed attempt. */
export async function handleRenewQuiz(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid quiz id.' });
    const [quiz] = await db.select().from(learningQuizzes).where(and(eq(learningQuizzes.id, id), eq(learningQuizzes.userId, uid))).limit(1);
    if (!quiz) return reply.status(404).send({ error: 'Quiz not found.' });
    if (quiz.passedAt) return reply.status(409).send({ error: 'You already passed this checkpoint.' });
    if (quiz.attempts === 0) return reply.status(409).send({ error: 'Take this quiz first.' });
    const questions = await makeQuestions(uid, quiz.pathId, quiz.stage);
    if (!Array.isArray(questions)) return reply.status(questions.status).send({ error: questions.error });
    const [row] = await db.update(learningQuizzes).set({ questions, attempts: 0, bestScore: null }).where(eq(learningQuizzes.id, id)).returning();
    return reply.status(200).send(quizView(row!));
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleSubmitQuiz(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid quiz id.' });
    const [quiz] = await db.select().from(learningQuizzes).where(and(eq(learningQuizzes.id, id), eq(learningQuizzes.userId, uid))).limit(1);
    if (!quiz) return reply.status(404).send({ error: 'Quiz not found.' });

    const graded = gradeQuiz(quiz.questions, ((request.body ?? {}) as { answers?: unknown }).answers);
    const now = new Date();
    const best = Math.max(quiz.bestScore ?? 0, graded.score);
    await db
      .update(learningQuizzes)
      .set({ attempts: quiz.attempts + 1, bestScore: best, lastAttemptAt: now, ...(graded.passed && !quiz.passedAt ? { passedAt: now } : {}) })
      .where(eq(learningQuizzes.id, id));

    // Every question becomes a review card: the ones missed come back tomorrow, the others in a few days.
    for (const [i, r] of graded.results.entries()) {
      const first = firstReview(r.correct, now);
      const card = quiz.questions[i]!;
      const [existing] = await db.select().from(reviewItems).where(and(eq(reviewItems.quizId, id), eq(reviewItems.qIndex, i))).limit(1);
      if (!existing) {
        await db.insert(reviewItems).values({ userId: uid, quizId: id, qIndex: i, card, box: first.box, dueAt: first.dueAt, lastAt: now, lapses: r.correct ? 0 : 1 });
      } else if (!r.correct) {
        await db.update(reviewItems).set({ box: 1, dueAt: first.dueAt, lastAt: now, lapses: existing.lapses + 1 }).where(eq(reviewItems.id, existing.id));
      }
    }
    // Only the first attempt on a set of questions is evidence: afterwards the answers have been shown.
    if (quiz.attempts === 0) await recordEvidence(uid, graded.results.filter((r) => r.topic).map((r, i) => ({ topic: r.topic, type: 'quiz' as const, outcome: r.correct ? 1 : 0, ref: `quiz:${id}:${i}:${quiz.questions[i]?.question.slice(0, 40) ?? ''}` }))).catch((e) => request.log.warn(e));
    return reply.status(200).send({ score: graded.score, total: graded.total, passed: graded.passed || !!quiz.passedAt, results: graded.results, path: await pathView(uid, quiz.pathId) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ spaced review ------------------------------ */

export async function handleDueReviews(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const now = new Date();
    const due = await db.select().from(reviewItems).where(and(eq(reviewItems.userId, uid), lte(reviewItems.dueAt, now))).orderBy(asc(reviewItems.dueAt)).limit(10);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(reviewItems).where(and(eq(reviewItems.userId, uid), lte(reviewItems.dueAt, now)));
    const [{ all }] = await db.select({ all: sql<number>`count(*)::int` }).from(reviewItems).where(eq(reviewItems.userId, uid));
    return reply.status(200).send({ due: due.map((d) => ({ id: d.id, box: d.box, ...publicQuestion(d.card) })), dueCount: total, cards: all });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleAnswerReview(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const choice = Number(((request.body ?? {}) as { choice?: unknown }).choice);
    if (!id || !UUID_RE.test(id) || !Number.isInteger(choice) || choice < 0 || choice > 3) return reply.status(400).send({ error: 'Send the index of your answer (0 to 3).' });
    const [item] = await db.select().from(reviewItems).where(and(eq(reviewItems.id, id), eq(reviewItems.userId, uid))).limit(1);
    if (!item) return reply.status(404).send({ error: 'Card not found.' });
    const correct = choice === item.card.answer;
    const next = nextReview(item.box, correct);
    await db.update(reviewItems).set({ box: next.box, dueAt: next.dueAt, lastAt: new Date(), lapses: correct ? item.lapses : item.lapses + 1 }).where(eq(reviewItems.id, id));
    // A card answered before it is due, or again the same day, shows nothing new (the answer was just shown).
    if (item.card.topic && item.dueAt <= new Date()) await recordEvidence(uid, [{ topic: item.card.topic, type: 'review', outcome: correct ? 1 : 0, ref: `review:${id}:${new Date().toISOString().slice(0, 10)}` }]).catch((e) => request.log.warn(e));
    return reply.status(200).send({ correct, answer: item.card.answer, explanation: item.card.explanation, nextBox: next.box, nextDueAt: next.dueAt });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ Codewars ------------------------------ */

export async function handleLinkCodewars(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const username = String(((request.body ?? {}) as { username?: unknown }).username ?? '').trim();
    if (!CODEWARS_USER.test(username)) return reply.status(400).send({ error: 'That does not look like a Codewars username.' });
    try {
      await fetchSolved(username, fetch, 1);
    } catch (err) {
      return reply.status((err as Error).message === 'not_found' ? 404 : 502).send({ error: (err as Error).message === 'not_found' ? 'No Codewars user has that name.' : 'Codewars did not answer. Try again in a moment.' });
    }
    const updated = await db.update(learningProfiles).set({ codewarsUsername: username }).where(eq(learningProfiles.userId, uid)).returning({ u: learningProfiles.codewarsUsername });
    if (updated.length === 0) return reply.status(409).send({ error: 'Set your learning preferences first.' });
    return reply.status(200).send({ username });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleUnlinkCodewars(request: FastifyRequest, reply: FastifyReply) {
  try {
    await db.update(learningProfiles).set({ codewarsUsername: null, codewarsSyncedAt: null }).where(eq(learningProfiles.userId, userId(request)));
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Ticks the steps whose Codewars kata the learner has solved. */
export async function handleSyncCodewars(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [lp] = await db.select({ u: learningProfiles.codewarsUsername, at: learningProfiles.codewarsSyncedAt }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    if (!lp?.u) return reply.status(409).send({ error: 'Link your Codewars account first.' });
    if (lp.at && Date.now() - lp.at.getTime() < 30_000) return reply.status(429).send({ error: 'Synced a moment ago. Give it half a minute.' });

    let solved;
    try {
      solved = await fetchSolved(lp.u);
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message === 'not_found' ? 'That Codewars user no longer exists.' : 'Codewars did not answer. Try again in a moment.' });
    }
    const steps = await db
      .select({ id: learningSteps.id, url: contents.url, status: learningSteps.status })
      .from(learningSteps)
      .innerJoin(contents, eq(contents.id, learningSteps.contentId))
      .where(and(eq(learningSteps.userId, uid), sql`${contents.url} like '%codewars.com/kata/%'`));
    const matched = new Set(matchSolved(steps, solved));
    const toTick = steps.filter((s) => matched.has(s.id) && s.status !== 'done').map((s) => s.id);
    if (toTick.length > 0) {
      await db.update(learningSteps).set({ status: 'done', completedAt: new Date(), verifiedBy: 'codewars' }).where(inArray(learningSteps.id, toTick));
      await recordStepEvidence(uid, toTick.map((id) => ({ id, verifiedBy: 'codewars', done: true }))).catch((e) => request.log.warn(e));
    }
    await db.update(learningProfiles).set({ codewarsSyncedAt: new Date() }).where(eq(learningProfiles.userId, uid));
    return reply.status(200).send({ solved: solved.length, inYourPaths: matched.size, newlyDone: toTick.length });
  } catch (e) {
    return fail(request, reply, e);
  }
}

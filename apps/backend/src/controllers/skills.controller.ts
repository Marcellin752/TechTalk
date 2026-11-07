import { FastifyRequest, FastifyReply } from 'fastify';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { conceptEdges, conceptEvaluations, concepts, edgeFeedback, learningProfiles, skillEvidence } from '../db/schema.js';
import { backfill, loadGraph, recordEvidence } from '../services/skills/store.js';
import { missingPrerequisites } from '../services/skills/graph.js';
import { estimate, type EvidenceType } from '../services/skills/mastery.js';
import { criteriaFor, explainPrompt, explanationOutcome, MAX_EXPLANATION, MIN_EXPLANATION, parseEvaluation, type Criterion, type Evaluation } from '../services/skills/explain.js';
import { generate, LlmUnavailableError, providerChain } from '../services/kairos/llm.js';
import { searchCatalog } from '../services/kairos/retrieval.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const userId = (r: FastifyRequest) => (r.user as { id: string }).id;
const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};
const EXPLAIN_PER_DAY = 20;

/** The learner's skills and the graph around them. Shows concepts with evidence, and what is ready to learn next. */
export async function handleSkills(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    await backfill(uid);
    const g = await loadGraph(uid);
    const counts = { applied: 0, understood: 0, learning: 0, exploring: 0 };
    for (const n of g.nodes) if (n.level in counts) counts[n.level as keyof typeof counts]++;
    // Only what is relevant to this learner: concepts with evidence, those they could learn next, and the links between them.
    const near = new Set(g.nodes.filter((n) => n.level !== 'unseen').map((n) => n.slug));
    for (const s of g.ready.slice(0, 12)) near.add(s);
    for (const e of g.edges) if (e.type === 'prerequisite' && near.has(e.to) && !e.hidden) near.add(e.from);
    return reply.status(200).send({
      summary: counts,
      nodes: g.nodes.filter((n) => near.has(n.slug)).map((n) => ({ slug: n.slug, name: n.name, area: n.area, level: n.level, mastery: n.mastery, confidence: n.confidence, trend: n.trend, lastAt: n.lastAt, evidenceCount: n.evidenceCount })),
      edges: g.edges.filter((e) => near.has(e.from) && near.has(e.to)).map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type, source: e.source, hidden: e.hidden })),
      ready: g.ready.slice(0, 12),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** One concept in full: why the level is what it is, the evidence, what to learn first, resources, past explanations. */
export async function handleSkill(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { slug } = request.params as { slug?: string };
    if (!slug || !SLUG_RE.test(slug)) return reply.status(400).send({ error: 'Invalid concept.' });
    const g = await loadGraph(uid);
    const node = g.nodes.find((n) => n.slug === slug);
    if (!node) return reply.status(404).send({ error: 'Concept not found.' });

    const [concept] = await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.slug, slug)).limit(1);
    const evidence = await db
      .select({ id: skillEvidence.id, type: skillEvidence.type, outcome: skillEvidence.outcome, ref: skillEvidence.ref, at: skillEvidence.createdAt })
      .from(skillEvidence)
      .where(and(eq(skillEvidence.userId, uid), eq(skillEvidence.conceptId, concept!.id)))
      .orderBy(desc(skillEvidence.createdAt))
      .limit(40);
    const evaluations = await db
      .select({ id: conceptEvaluations.id, text: conceptEvaluations.text, criteria: conceptEvaluations.criteria, feedback: conceptEvaluations.feedback, score: conceptEvaluations.score, revised: conceptEvaluations.revised, createdAt: conceptEvaluations.createdAt })
      .from(conceptEvaluations)
      .where(and(eq(conceptEvaluations.userId, uid), eq(conceptEvaluations.conceptId, concept!.id)))
      .orderBy(desc(conceptEvaluations.createdAt))
      .limit(5);

    const active = g.edges.filter((e) => !e.hidden);
    const nameOf = (s: string) => g.nodes.find((n) => n.slug === s);
    const links = (pick: (e: (typeof g.edges)[number]) => string | null) =>
      g.edges.filter((e) => e.type === 'prerequisite').map((e) => ({ e, other: pick(e) })).filter((x) => x.other).map(({ e, other }) => ({ edgeId: e.id, hidden: e.hidden, slug: other!, name: nameOf(other!)?.name ?? other!, level: nameOf(other!)?.level ?? 'unseen' }));

    return reply.status(200).send({
      slug, name: node.name, area: node.area, description: node.description, level: node.level, mastery: node.mastery, confidence: node.confidence, trend: node.trend, reasons: node.reasons, counts: node.counts,
      evidence: evidence.map((e) => ({ id: e.id, type: e.type, outcome: e.outcome, at: e.at })),
      prerequisites: links((e) => (e.to === slug ? e.from : null)),
      unlocks: links((e) => (e.from === slug ? e.to : null)),
      missing: missingPrerequisites(slug, g.nodes, active).slice(0, 6).map((s) => ({ slug: s, name: nameOf(s)?.name ?? s })),
      criteria: criteriaFor({ name: node.name, description: node.description ?? node.name }),
      evaluations,
      resources: (await searchCatalog(node.name)).slice(0, 4).map((r) => ({ id: r.id, title: r.title, url: r.url, source: r.source, type: r.type })),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

async function evaluate(concept: { name: string; description: string }, criteria: Criterion[], text: string, level: string, objection?: string): Promise<Evaluation | { error: string; status: number }> {
  if (providerChain().length === 0) return { error: 'Evaluations are done by Kairos, which is not configured on this server.', status: 503 };
  const { system, user } = explainPrompt(concept, criteria, text, level, objection);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await generate(system, [{ role: 'user', content: user }], { maxTokens: 900, temperature: 0.1 });
      const parsed = parseEvaluation(r.text, criteria);
      if (parsed) return parsed;
    } catch (err) {
      if (err instanceof LlmUnavailableError) return { error: 'Kairos is catching its breath. Try again in a moment.', status: 503 };
      throw err;
    }
  }
  return { error: 'Kairos could not judge this one. Try again.', status: 503 };
}

/** The learner explains a concept in their own words; Kairos judges it against visible criteria, and the result becomes evidence. */
export async function handleExplain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { slug } = request.params as { slug?: string };
    const text = String(((request.body ?? {}) as { text?: unknown }).text ?? '').trim();
    if (!slug || !SLUG_RE.test(slug)) return reply.status(400).send({ error: 'Invalid concept.' });
    if (text.length < MIN_EXPLANATION) return reply.status(400).send({ error: `Write a little more: at least ${MIN_EXPLANATION} characters, in your own words.` });
    if (text.length > MAX_EXPLANATION) return reply.status(400).send({ error: `Keep it under ${MAX_EXPLANATION} characters.` });
    const [concept] = await db.select().from(concepts).where(eq(concepts.slug, slug)).limit(1);
    if (!concept) return reply.status(404).send({ error: 'Concept not found.' });

    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(conceptEvaluations).where(and(eq(conceptEvaluations.userId, uid), gte(conceptEvaluations.createdAt, new Date(Date.now() - 86_400_000))));
    if (n >= EXPLAIN_PER_DAY) return reply.status(429).send({ error: 'That is a lot of explanations for today. Come back tomorrow.' });

    const [lp] = await db.select({ level: learningProfiles.level }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    const def = { name: concept.name, description: concept.description ?? concept.name };
    const criteria = criteriaFor(def);
    const result = await evaluate(def, criteria, text, lp?.level ?? 'basics');
    if ('error' in result) return reply.status(result.status).send({ error: result.error });

    const [row] = await db.insert(conceptEvaluations).values({ userId: uid, conceptId: concept.id, text, criteria: result.criteria, feedback: result.feedback, score: result.score }).returning();
    await recordEvidence(uid, [{ topic: slug, type: 'explained', outcome: explanationOutcome(result), ref: `explained:${row!.id}` }]);
    return reply.status(200).send({ evaluation: { id: row!.id, criteria: result.criteria, feedback: result.feedback, score: result.score, revised: false } });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** The learner disagrees with a verdict: it is judged again, from scratch, with their objection in view. The new verdict replaces the old as evidence. */
export async function handleContest(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const reason = String(((request.body ?? {}) as { reason?: unknown }).reason ?? '').trim().slice(0, 400);
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid evaluation.' });
    if (reason.length < 8) return reply.status(400).send({ error: 'Say what you think was missed (a sentence is enough).' });
    const [ev] = await db.select().from(conceptEvaluations).where(and(eq(conceptEvaluations.id, id), eq(conceptEvaluations.userId, uid))).limit(1);
    if (!ev) return reply.status(404).send({ error: 'Evaluation not found.' });
    if (ev.revised) return reply.status(409).send({ error: 'This one was already reviewed once.' });
    const [concept] = await db.select().from(concepts).where(eq(concepts.id, ev.conceptId)).limit(1);
    const [lp] = await db.select({ level: learningProfiles.level }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    const def = { name: concept!.name, description: concept!.description ?? concept!.name };
    const criteria = criteriaFor(def);
    const result = await evaluate(def, criteria, ev.text, lp?.level ?? 'basics', reason);
    if ('error' in result) return reply.status(result.status).send({ error: result.error });

    await db.update(conceptEvaluations).set({ criteria: result.criteria, feedback: result.feedback, score: result.score, revised: true }).where(eq(conceptEvaluations.id, id));
    // The earlier verdict no longer stands as evidence: the revised one replaces it.
    await db.update(skillEvidence).set({ outcome: explanationOutcome(result) }).where(and(eq(skillEvidence.userId, uid), eq(skillEvidence.ref, `explained:${id}`)));
    return reply.status(200).send({ evaluation: { id, criteria: result.criteria, feedback: result.feedback, score: result.score, revised: true } });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Hide (or show again) a link the learner disagrees with. */
export async function handleHideEdge(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const hidden = ((request.body ?? {}) as { hidden?: unknown }).hidden;
    if (!id || !UUID_RE.test(id) || typeof hidden !== 'boolean') return reply.status(400).send({ error: 'Send { "hidden": true or false }.' });
    const [edge] = await db.select({ id: conceptEdges.id }).from(conceptEdges).where(eq(conceptEdges.id, id)).limit(1);
    if (!edge) return reply.status(404).send({ error: 'Link not found.' });
    if (hidden) await db.insert(edgeFeedback).values({ userId: uid, edgeId: id }).onConflictDoNothing();
    else await db.delete(edgeFeedback).where(and(eq(edgeFeedback.userId, uid), eq(edgeFeedback.edgeId, id)));
    return reply.status(200).send({ id, hidden });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Forget what the system has recorded: for one concept, or everything. */
export async function handleForget(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { slug } = request.params as { slug?: string };
    if (slug) {
      if (!SLUG_RE.test(slug)) return reply.status(400).send({ error: 'Invalid concept.' });
      const [c] = await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.slug, slug)).limit(1);
      if (c) {
        await db.delete(skillEvidence).where(and(eq(skillEvidence.userId, uid), eq(skillEvidence.conceptId, c.id)));
        await db.delete(conceptEvaluations).where(and(eq(conceptEvaluations.userId, uid), eq(conceptEvaluations.conceptId, c.id)));
      }
    } else {
      await db.delete(skillEvidence).where(eq(skillEvidence.userId, uid));
      await db.delete(conceptEvaluations).where(eq(conceptEvaluations.userId, uid));
    }
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

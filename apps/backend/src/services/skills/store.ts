import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { conceptEdges, concepts, contents, edgeFeedback, learningPaths, learningProfiles, learningQuizzes, learningSteps, skillEvidence, users } from '../../db/schema.js';
import { ONTOLOGY, bySlug, conceptSlug, titleCase } from './ontology.js';
import { estimate, type Estimate, type Evidence, type EvidenceType } from './mastery.js';
import { readyToLearn, type GEdge } from './graph.js';

let ontologyLoaded = false;

/** Makes sure the curated concepts and their links are in the database. Safe to call any time; cheap after the first. */
export async function ensureOntology(force = false): Promise<void> {
  if (ontologyLoaded && !force) return;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(concepts).where(eq(concepts.curated, true));
  if (n >= ONTOLOGY.length && !force) return void (ontologyLoaded = true);

  for (const c of ONTOLOGY) {
    await db.insert(concepts).values({ slug: c.slug, name: c.name, area: c.area, description: c.description, curated: true }).onConflictDoUpdate({ target: concepts.slug, set: { name: c.name, area: c.area, description: c.description, curated: true } });
  }
  const rows = await db.select({ id: concepts.id, slug: concepts.slug }).from(concepts).where(eq(concepts.curated, true));
  const id = new Map(rows.map((r) => [r.slug, r.id]));
  for (const c of ONTOLOGY) {
    for (const r of c.requires ?? []) await db.insert(conceptEdges).values({ fromId: id.get(r)!, toId: id.get(c.slug)!, type: 'prerequisite', source: 'curated' }).onConflictDoNothing();
    for (const r of c.related ?? []) await db.insert(conceptEdges).values({ fromId: id.get(c.slug)!, toId: id.get(r)!, type: 'related', source: 'curated' }).onConflictDoNothing();
  }
  ontologyLoaded = true;
}

/** The concept ids for some topics, creating the ones nobody has met before. */
export async function conceptIds(topics: string[]): Promise<Map<string, string>> {
  await ensureOntology();
  const slugs = [...new Set(topics.map(conceptSlug).filter((s) => s.length >= 1))];
  if (slugs.length === 0) return new Map();
  const have = await db.select({ id: concepts.id, slug: concepts.slug }).from(concepts).where(inArray(concepts.slug, slugs));
  const out = new Map(have.map((c) => [c.slug, c.id]));
  for (const slug of slugs.filter((s) => !out.has(s))) {
    const name = bySlug.get(slug)?.name ?? titleCase(slug);
    const [row] = await db.insert(concepts).values({ slug, name, area: 'general', curated: false }).onConflictDoNothing().returning({ id: concepts.id });
    const id = row?.id ?? (await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.slug, slug)).limit(1))[0]?.id;
    if (id) out.set(slug, id);
  }
  return out;
}

export interface NewEvidence { topic: string; type: EvidenceType; outcome?: number; ref: string; at?: Date }

/** Records what happened. The same fact (same ref) is never counted twice. */
export async function recordEvidence(userId: string, items: NewEvidence[]): Promise<void> {
  if (items.length === 0) return;
  const ids = await conceptIds(items.map((i) => i.topic));
  for (const it of items) {
    const conceptId = ids.get(conceptSlug(it.topic));
    if (!conceptId) continue;
    await db.insert(skillEvidence).values({ userId, conceptId, type: it.type, outcome: Math.max(0, Math.min(1, it.outcome ?? 1)), ref: it.ref.slice(0, 120), ...(it.at ? { createdAt: it.at } : {}) }).onConflictDoNothing();
  }
}

/** The topics a step is about: its stage's topics (school paths) plus what the resource itself is tagged with. */
export async function topicsOfSteps(stepIds: string[]): Promise<Map<string, string[]>> {
  if (stepIds.length === 0) return new Map();
  const rows = await db
    .select({ id: learningSteps.id, stage: learningSteps.stage, stages: learningPaths.stages, categories: contents.categories, meta: contents.meta })
    .from(learningSteps)
    .innerJoin(learningPaths, eq(learningPaths.id, learningSteps.pathId))
    .innerJoin(contents, eq(contents.id, learningSteps.contentId))
    .where(inArray(learningSteps.id, stepIds));
  return new Map(
    rows.map((r) => {
      const fromStage = r.stages.find((s) => s.index === r.stage)?.topics ?? [];
      const tags = Array.isArray((r.meta as { tags?: unknown } | null)?.tags) ? ((r.meta as { tags: string[] }).tags) : [];
      // Broad classifier labels ("Backend", "General") say too little to be a skill: only real topics count.
      const topics = [...new Set([...fromStage, ...tags])].filter((t) => typeof t === 'string' && t.length >= 1).slice(0, 8);
      return [r.id, topics];
    }),
  );
}

/** Evidence from finished steps: a ticked step is exposure; a verified exercise is the real thing. */
export async function recordStepEvidence(userId: string, steps: Array<{ id: string; verifiedBy?: string | null; done: boolean }>): Promise<void> {
  const topics = await topicsOfSteps(steps.map((s) => s.id));
  const items: NewEvidence[] = [];
  for (const s of steps) {
    for (const topic of topics.get(s.id) ?? []) {
      items.push({ topic, type: s.done ? (s.verifiedBy ? 'exercise' : 'step') : 'read', ref: `${s.done ? 'step' : 'read'}:${s.id}` });
    }
  }
  await recordEvidence(userId, items);
}

/** First visit: turn what the learner already did (finished steps, passed quizzes) into evidence, once. */
export async function backfill(userId: string): Promise<void> {
  const [u] = await db.select({ at: users.skillsBackfilledAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.at) return;
  // Claim it first: two requests at once must not import twice, and erasing the evidence later must stay erased.
  const claimed = await db.update(users).set({ skillsBackfilledAt: new Date() }).where(and(eq(users.id, userId), sql`${users.skillsBackfilledAt} is null`)).returning({ id: users.id });
  if (claimed.length === 0) return;
  const done = await db.select({ id: learningSteps.id, verifiedBy: learningSteps.verifiedBy, at: learningSteps.completedAt }).from(learningSteps).where(and(eq(learningSteps.userId, userId), eq(learningSteps.status, 'done')));
  const topics = await topicsOfSteps(done.map((d) => d.id));
  const items: NewEvidence[] = [];
  for (const d of done) for (const t of topics.get(d.id) ?? []) items.push({ topic: t, type: d.verifiedBy ? 'exercise' : 'step', ref: `step:${d.id}`, at: d.at ?? undefined });
  const quizzes = await db.select().from(learningQuizzes).where(and(eq(learningQuizzes.userId, userId), sql`${learningQuizzes.passedAt} is not null`));
  for (const q of quizzes) for (const [i, question] of q.questions.entries()) if (question.topic) items.push({ topic: question.topic, type: 'quiz', outcome: (q.bestScore ?? 0) / Math.max(1, q.questions.length), ref: `quiz:${q.id}:best:${i}`, at: q.passedAt ?? undefined });
  await recordEvidence(userId, items);
}

export interface SkillNode extends Estimate { slug: string; name: string; area: string; description: string | null; curated: boolean; evidenceCount: number }

/** The learner's graph: every concept they have any evidence about, plus the curated ones around them. */
export async function loadGraph(userId: string) {
  await ensureOntology();
  const evRows = await db
    .select({ slug: concepts.slug, type: skillEvidence.type, outcome: skillEvidence.outcome, at: skillEvidence.createdAt, ref: skillEvidence.ref })
    .from(skillEvidence)
    .innerJoin(concepts, eq(concepts.id, skillEvidence.conceptId))
    .where(eq(skillEvidence.userId, userId));
  const bySlugEvidence = new Map<string, Evidence[]>();
  for (const r of evRows) bySlugEvidence.set(r.slug, [...(bySlugEvidence.get(r.slug) ?? []), { type: r.type as EvidenceType, outcome: r.outcome, at: r.at, ref: r.ref }]);

  const all = await db.select().from(concepts);
  const edgeRows = await db
    .select({ id: conceptEdges.id, from: sql<string>`f.slug`, to: sql<string>`t.slug`, type: conceptEdges.type, source: conceptEdges.source })
    .from(conceptEdges)
    .innerJoin(sql`concepts f`, sql`f.id = ${conceptEdges.fromId}`)
    .innerJoin(sql`concepts t`, sql`t.id = ${conceptEdges.toId}`);
  const hidden = new Set((await db.select({ id: edgeFeedback.edgeId }).from(edgeFeedback).where(eq(edgeFeedback.userId, userId))).map((h) => h.id));

  const edges: Array<GEdge & { id: string; source: string; hidden: boolean }> = edgeRows.map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type as GEdge['type'], source: e.source, hidden: hidden.has(e.id) }));
  const nodes: SkillNode[] = all.map((c) => {
    const ev = bySlugEvidence.get(c.slug) ?? [];
    return { slug: c.slug, name: c.name, area: c.area, description: c.description, curated: c.curated, evidenceCount: ev.length, ...estimate(ev) };
  });
  const active = edges.filter((e) => !e.hidden);
  return { nodes, edges, ready: readyToLearn(nodes, active) };
}

/** One learner's level for one topic, computed from their evidence. */
export async function levelsFor(userIds: string[], topic: string): Promise<Map<string, Estimate['level']>> {
  const out = new Map<string, Estimate['level']>();
  if (userIds.length === 0) return out;
  const slug = conceptSlug(topic);
  const rows = await db
    .select({ userId: skillEvidence.userId, type: skillEvidence.type, outcome: skillEvidence.outcome, at: skillEvidence.createdAt, ref: skillEvidence.ref })
    .from(skillEvidence)
    .innerJoin(concepts, eq(concepts.id, skillEvidence.conceptId))
    .where(and(eq(concepts.slug, slug), inArray(skillEvidence.userId, userIds)));
  const by = new Map<string, Evidence[]>();
  for (const r of rows) by.set(r.userId, [...(by.get(r.userId) ?? []), { type: r.type as EvidenceType, outcome: r.outcome, at: r.at, ref: r.ref }]);
  for (const id of userIds) out.set(id, estimate(by.get(id) ?? []).level);
  return out;
}

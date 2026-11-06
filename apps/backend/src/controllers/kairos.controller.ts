import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { kairosConversations, kairosMessages } from '../db/schema.js';
import { config } from '../config/env.js';
import { generate, LlmUnavailableError, providerChain, type ChatMessage } from '../services/kairos/llm.js';
import { buildSystemPrompt, mentorNote, usedSources, wrapLearnerMessage } from '../services/kairos/prompt.js';
import { loadLearnerContext, searchCatalog } from '../services/kairos/retrieval.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_MESSAGE = 1500;
const HISTORY_TURNS = 10; // messages sent back to the model: enough context, bounded cost

const userId = (r: FastifyRequest) => (r.user as { id: string }).id;

export function titleFrom(message: string): string {
  const t = message.replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
}

/** Lets the UI hide Kairos when no model is configured. */
export async function handleKairosStatus(_request: FastifyRequest, reply: FastifyReply) {
  const chain = providerChain();
  return reply.status(200).send({ available: chain.length > 0, providers: chain.map((t) => t.provider) });
}

export async function handleKairosChat(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const body = (request.body ?? {}) as { message?: unknown; conversationId?: unknown; lang?: unknown };
    const uiLang = body.lang === 'fr' || body.lang === 'en' ? body.lang : undefined;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return reply.status(400).send({ error: 'Write a message first.' });
    if (message.length > MAX_MESSAGE) return reply.status(400).send({ error: `Messages are limited to ${MAX_MESSAGE} characters.` });
    if (body.conversationId !== undefined && (typeof body.conversationId !== 'string' || !UUID_RE.test(body.conversationId))) {
      return reply.status(400).send({ error: 'Invalid conversation id.' });
    }
    if (providerChain().length === 0) return reply.status(503).send({ error: 'Kairos is not configured on this server.' });

    // A daily cap per learner keeps free-tier quotas for everyone.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ today }] = await db
      .select({ today: sql<number>`count(*)::int` })
      .from(kairosMessages)
      .where(and(eq(kairosMessages.userId, uid), eq(kairosMessages.role, 'user'), gte(kairosMessages.createdAt, startOfDay)));
    if (today >= config.llm.dailyMessageLimit) {
      return reply.status(429).send({ error: `You reached today's limit of ${config.llm.dailyMessageLimit} messages. Kairos will be back tomorrow.` });
    }

    // The conversation: an existing one of theirs, or a new one.
    let conversationId = body.conversationId as string | undefined;
    let isNew = false;
    let history: ChatMessage[] = [];
    if (conversationId) {
      const [convo] = await db.select({ id: kairosConversations.id }).from(kairosConversations).where(and(eq(kairosConversations.id, conversationId), eq(kairosConversations.userId, uid))).limit(1);
      if (!convo) return reply.status(404).send({ error: 'Conversation not found.' });
      const past = await db
        .select({ role: kairosMessages.role, content: kairosMessages.content })
        .from(kairosMessages)
        .where(eq(kairosMessages.conversationId, conversationId))
        .orderBy(desc(kairosMessages.createdAt))
        .limit(HISTORY_TURNS);
      history = past.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    } else {
      const [created] = await db.insert(kairosConversations).values({ userId: uid, title: titleFrom(message) }).returning();
      conversationId = created!.id;
      isNew = true;
    }

    const [learner, hits] = await Promise.all([loadLearnerContext(uid), searchCatalog(message)]);
    const system = buildSystemPrompt(learner, hits, new Date(), uiLang);
    const note = mentorNote(message, history);
    const messages: ChatMessage[] = [...history, { role: 'user', content: `${wrapLearnerMessage(message)}${note ? `\n${note}` : ''}` }];

    let result;
    try {
      result = await generate(system, messages, { maxTokens: 900 });
    } catch (err) {
      if (isNew) await db.delete(kairosConversations).where(eq(kairosConversations.id, conversationId!));
      if (err instanceof LlmUnavailableError) {
        request.log.warn({ attempts: err.attempts }, 'kairos_llm_unavailable');
        return reply.status(503).send({ error: 'Kairos is catching its breath. Try again in a moment.' });
      }
      throw err;
    }

    const sources = usedSources(result.text, hits);
    await db.insert(kairosMessages).values({ conversationId: conversationId!, userId: uid, role: 'user', content: message });
    const [reply_] = await db
      .insert(kairosMessages)
      .values({ conversationId: conversationId!, userId: uid, role: 'assistant', content: result.text, sources: sql`${JSON.stringify(sources)}::text::jsonb` as never, model: `${result.provider}:${result.model}` })
      .returning();
    await db.update(kairosConversations).set({ updatedAt: new Date() }).where(eq(kairosConversations.id, conversationId!));

    return reply.status(200).send({
      conversationId,
      title: isNew ? titleFrom(message) : undefined,
      message: { id: reply_!.id, role: 'assistant', content: result.text, sources, createdAt: reply_!.createdAt },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleListConversations(request: FastifyRequest, reply: FastifyReply) {
  try {
    const rows = await db
      .select({ id: kairosConversations.id, title: kairosConversations.title, updatedAt: kairosConversations.updatedAt })
      .from(kairosConversations)
      .where(eq(kairosConversations.userId, userId(request)))
      .orderBy(desc(kairosConversations.updatedAt))
      .limit(40);
    return reply.status(200).send({ conversations: rows });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetConversation(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid conversation id.' });
    const [convo] = await db.select().from(kairosConversations).where(and(eq(kairosConversations.id, id), eq(kairosConversations.userId, userId(request)))).limit(1);
    if (!convo) return reply.status(404).send({ error: 'Conversation not found.' });
    const messages = await db
      .select({ id: kairosMessages.id, role: kairosMessages.role, content: kairosMessages.content, sources: kairosMessages.sources, createdAt: kairosMessages.createdAt })
      .from(kairosMessages)
      .where(eq(kairosMessages.conversationId, id))
      .orderBy(asc(kairosMessages.createdAt));
    return reply.status(200).send({ conversation: { id: convo.id, title: convo.title }, messages });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleDeleteConversation(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid conversation id.' });
    await db.delete(kairosConversations).where(and(eq(kairosConversations.id, id), eq(kairosConversations.userId, userId(request))));
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleClearConversations(request: FastifyRequest, reply: FastifyReply) {
  try {
    await db.delete(kairosConversations).where(eq(kairosConversations.userId, userId(request)));
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

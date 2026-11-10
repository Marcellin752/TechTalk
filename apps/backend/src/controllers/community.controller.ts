import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { mentorProfiles, mentorRequests, roomMembers, roomMessages, roomReports, studyRooms, users } from '../db/schema.js';
import { levelsFor } from '../services/skills/store.js';
import { conceptSlug } from '../services/skills/ontology.js';
import { matchMentors } from '../services/growth/mentors.js';
import { UUID_RE, body, fail, text, topicList, userId } from './common.js';

/* ------------------------------ Study rooms ------------------------------ */
/* Text only, members only. Safety: short messages, rate limits, reports (three hide a message), the creator can hide and remove. */

const HIDE_AFTER_REPORTS = 3;
const MAX_ROOMS_PER_USER = 3;
const MAX_ROOM_MEMBERS = 50;

export async function handleRooms(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const topic = text((request.query as { topic?: string }).topic, 1, 60)?.toLowerCase();
    const rows = await db
      .select({ id: studyRooms.id, name: studyRooms.name, topic: studyRooms.topic, createdBy: studyRooms.createdBy, members: sql<number>`(select count(*)::int from room_members m where m.room_id = ${studyRooms.id})`, mine: sql<boolean>`exists(select 1 from room_members m where m.room_id = ${studyRooms.id} and m.user_id = ${uid})` })
      .from(studyRooms)
      .where(topic ? eq(studyRooms.topic, topic) : undefined)
      .orderBy(desc(studyRooms.createdAt))
      .limit(60);
    return reply.status(200).send({ rooms: rows.map((r) => ({ id: r.id, name: r.name, topic: r.topic, members: r.members, joined: r.mine, owner: r.createdBy === uid })) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCreateRoom(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = body(request);
    const name = text(b.name, 3, 60);
    const topic = text(b.topic, 1, 60)?.toLowerCase();
    if (!name || !topic) return reply.status(400).send({ error: 'A name (3 to 60 characters) and a topic are needed.' });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(studyRooms).where(eq(studyRooms.createdBy, uid));
    if (n >= MAX_ROOMS_PER_USER) return reply.status(409).send({ error: `You can run up to ${MAX_ROOMS_PER_USER} rooms.` });
    const [room] = await db.insert(studyRooms).values({ name, topic, createdBy: uid }).returning();
    await db.insert(roomMembers).values({ roomId: room!.id, userId: uid });
    return reply.status(201).send({ room: { id: room!.id, name, topic, members: 1, joined: true, owner: true } });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleJoinRoom(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid room.' });
    const [room] = await db.select({ id: studyRooms.id }).from(studyRooms).where(eq(studyRooms.id, id)).limit(1);
    if (!room) return reply.status(404).send({ error: 'Room not found.' });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(roomMembers).where(eq(roomMembers.roomId, id));
    if (n >= MAX_ROOM_MEMBERS) return reply.status(409).send({ error: 'This room is full.' });
    await db.insert(roomMembers).values({ roomId: id, userId: uid }).onConflictDoNothing();
    return reply.status(200).send({ joined: true });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleLeaveRoom(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid room.' });
    await db.delete(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, uid)));
    // A room nobody is in anymore disappears with its messages.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(roomMembers).where(eq(roomMembers.roomId, id));
    if (n === 0) await db.delete(studyRooms).where(eq(studyRooms.id, id));
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

async function isMember(roomId: string, uid: string) {
  const [m] = await db.select({ u: roomMembers.userId }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, uid))).limit(1);
  return !!m;
}

/** Messages of a room (members only). `after` is an ISO date: only newer messages, so polling stays cheap. */
export async function handleRoomMessages(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid room.' });
    if (!(await isMember(id, uid))) return reply.status(403).send({ error: 'Join the room first.' });
    const after = (request.query as { after?: string }).after;
    const afterDate = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
    const rows = await db
      .select({ id: roomMessages.id, body: roomMessages.body, createdAt: roomMessages.createdAt, userId: roomMessages.userId, name: users.name })
      .from(roomMessages)
      .innerJoin(users, eq(users.id, roomMessages.userId))
      .where(and(eq(roomMessages.roomId, id), eq(roomMessages.hidden, false), afterDate ? gt(roomMessages.createdAt, afterDate) : undefined))
      .orderBy(desc(roomMessages.createdAt))
      .limit(80);
    const [room] = await db.select({ name: studyRooms.name, topic: studyRooms.topic, createdBy: studyRooms.createdBy }).from(studyRooms).where(eq(studyRooms.id, id)).limit(1);
    return reply.status(200).send({ room: { name: room!.name, topic: room!.topic, owner: room!.createdBy === uid }, messages: rows.reverse().map((m) => ({ id: m.id, body: m.body, at: m.createdAt, author: m.name, mine: m.userId === uid })) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handlePostMessage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const msg = text(body(request).body, 1, 500);
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid room.' });
    if (!msg) return reply.status(400).send({ error: 'A message has 1 to 500 characters.' });
    if (!(await isMember(id, uid))) return reply.status(403).send({ error: 'Join the room first.' });
    const [row] = await db.insert(roomMessages).values({ roomId: id, userId: uid, body: msg }).returning();
    return reply.status(201).send({ message: { id: row!.id, body: msg, at: row!.createdAt, mine: true } });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Report a message (three members hide it) or, for the room's creator, hide it directly. */
export async function handleReportMessage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid message.' });
    const [m] = await db.select({ roomId: roomMessages.roomId, author: roomMessages.userId }).from(roomMessages).where(eq(roomMessages.id, id)).limit(1);
    if (!m) return reply.status(404).send({ error: 'Message not found.' });
    if (!(await isMember(m.roomId, uid))) return reply.status(403).send({ error: 'Join the room first.' });
    if (m.author === uid) return reply.status(400).send({ error: 'You cannot report your own message.' });
    const [room] = await db.select({ createdBy: studyRooms.createdBy }).from(studyRooms).where(eq(studyRooms.id, m.roomId)).limit(1);
    await db.insert(roomReports).values({ messageId: id, userId: uid }).onConflictDoNothing();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(roomReports).where(eq(roomReports.messageId, id));
    const hide = n >= HIDE_AFTER_REPORTS || room?.createdBy === uid;
    if (hide) await db.update(roomMessages).set({ hidden: true }).where(eq(roomMessages.id, id));
    return reply.status(200).send({ hidden: hide });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ Mentorship ------------------------------ */

export async function handleMentorProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const [p] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId(request))).limit(1);
    return reply.status(200).send({ profile: p ? { offering: p.offering, seeking: p.seeking, bio: p.bio, active: p.active } : null });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleSaveMentorProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = body(request);
    const offering = topicList(b.offering, 6);
    const seeking = topicList(b.seeking, 6);
    const bio = b.bio ? text(b.bio, 1, 280) : null;
    if (!offering || !seeking) return reply.status(400).send({ error: 'Topics: up to 6 each, short words.' });
    if (b.bio && !bio) return reply.status(400).send({ error: 'The bio is limited to 280 characters.' });
    const active = b.active !== false;
    await db.insert(mentorProfiles).values({ userId: uid, offering, seeking, bio, active }).onConflictDoUpdate({ target: mentorProfiles.userId, set: { offering, seeking, bio, active, updatedAt: new Date() } });
    return reply.status(200).send({ profile: { offering, seeking, bio, active } });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleLeaveMentoring(request: FastifyRequest, reply: FastifyReply) {
  try {
    await db.delete(mentorProfiles).where(eq(mentorProfiles.userId, userId(request)));
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** People who offer a topic AND whose evidence shows they understand it. */
export async function handleMentorMatch(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const topic = text((request.query as { topic?: string }).topic, 1, 40)?.toLowerCase();
    if (!topic) return reply.status(400).send({ error: 'Which topic?' });
    const cands = await db.select({ userId: mentorProfiles.userId, offering: mentorProfiles.offering, bio: mentorProfiles.bio, name: users.name }).from(mentorProfiles).innerJoin(users, eq(users.id, mentorProfiles.userId)).where(and(eq(mentorProfiles.active, true), sql`${topic} = any(${mentorProfiles.offering})`)).limit(40);
    const levels = await levelsFor(cands.map((c) => c.userId), topic);
    const matches = matchMentors(topic, cands.map((c) => ({ userId: c.userId, offering: c.offering, levels: { [topic]: levels.get(c.userId) ?? 'unseen' } })), uid);
    const info = new Map(cands.map((c) => [c.userId, c]));
    return reply.status(200).send({ topic, mentors: matches.slice(0, 12).map((m) => ({ userId: m.userId, name: info.get(m.userId)!.name, bio: info.get(m.userId)!.bio, level: m.level })), concept: conceptSlug(topic) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleMentorRequest(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = body(request);
    const toId = typeof b.toId === 'string' && UUID_RE.test(b.toId) ? b.toId : null;
    const topic = text(b.topic, 1, 40)?.toLowerCase();
    const message = text(b.message, 10, 400);
    if (!toId || !topic) return reply.status(400).send({ error: 'Choose a mentor and a topic.' });
    if (!message) return reply.status(400).send({ error: 'Say what you need help with (10 to 400 characters).' });
    if (toId === uid) return reply.status(400).send({ error: 'That is you.' });
    const [m] = await db.select({ offering: mentorProfiles.offering, active: mentorProfiles.active }).from(mentorProfiles).where(eq(mentorProfiles.userId, toId)).limit(1);
    if (!m || !m.active || !m.offering.includes(topic)) return reply.status(404).send({ error: 'This person does not offer that topic.' });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(mentorRequests).where(and(eq(mentorRequests.fromId, uid), eq(mentorRequests.status, 'pending')));
    if (n >= 5) return reply.status(429).send({ error: 'You already have 5 requests waiting. Let them answer first.' });
    const [dup] = await db.select({ id: mentorRequests.id }).from(mentorRequests).where(and(eq(mentorRequests.fromId, uid), eq(mentorRequests.toId, toId), eq(mentorRequests.status, 'pending'))).limit(1);
    if (dup) return reply.status(409).send({ error: 'You already asked this person.' });
    const [row] = await db.insert(mentorRequests).values({ fromId: uid, toId, topic, message }).returning();
    return reply.status(201).send({ id: row!.id });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleMentorRequests(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const rows = await db.select().from(mentorRequests).where(sql`${mentorRequests.fromId} = ${uid} or ${mentorRequests.toId} = ${uid}`).orderBy(desc(mentorRequests.createdAt)).limit(60);
    const ids = [...new Set(rows.flatMap((r) => [r.fromId, r.toId]))];
    const names = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
    const nm = new Map(names.map((n) => [n.id, n.name]));
    const shape = (r: (typeof rows)[number]) => ({ id: r.id, topic: r.topic, message: r.message, status: r.status, reply: r.status === 'accepted' ? r.reply : null, at: r.createdAt });
    return reply.status(200).send({
      received: rows.filter((r) => r.toId === uid).map((r) => ({ ...shape(r), from: nm.get(r.fromId) ?? '?' })),
      sent: rows.filter((r) => r.fromId === uid).map((r) => ({ ...shape(r), to: nm.get(r.toId) ?? '?' })),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleMentorRespond(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const b = body(request);
    if (!id || !UUID_RE.test(id) || typeof b.accept !== 'boolean') return reply.status(400).send({ error: 'Send { "accept": true or false }.' });
    const contact = b.accept ? text(b.contact, 3, 200) : null;
    if (b.accept && !contact) return reply.status(400).send({ error: 'Say how this person can reach you (3 to 200 characters). Nothing else is shared.' });
    const [r] = await db.select().from(mentorRequests).where(and(eq(mentorRequests.id, id), eq(mentorRequests.toId, uid))).limit(1);
    if (!r) return reply.status(404).send({ error: 'Request not found.' });
    if (r.status !== 'pending') return reply.status(409).send({ error: 'Already answered.' });
    await db.update(mentorRequests).set({ status: b.accept ? 'accepted' : 'declined', reply: contact }).where(eq(mentorRequests.id, id));
    return reply.status(200).send({ status: b.accept ? 'accepted' : 'declined' });
  } catch (e) {
    return fail(request, reply, e);
  }
}

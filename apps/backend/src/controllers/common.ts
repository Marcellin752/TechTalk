import { FastifyReply, FastifyRequest } from 'fastify';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const userId = (r: FastifyRequest) => (r.user as { id: string }).id;
export const body = (r: FastifyRequest) => (r.body ?? {}) as Record<string, unknown>;
export const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};
/** A trimmed string within bounds, or null. */
export function text(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max ? s : null;
}
/** Multi-line text: keeps line breaks. */
export function longText(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r/g, '').trim();
  return s.length >= min && s.length <= max ? s : null;
}
export function httpUrl(v: unknown, max = 300): string | null {
  if (typeof v !== 'string' || v.length > max) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
export function topicList(v: unknown, maxItems = 8): string[] | null {
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out = v.map((t) => text(t, 1, 40)?.toLowerCase());
  return out.every(Boolean) ? [...new Set(out as string[])] : null;
}

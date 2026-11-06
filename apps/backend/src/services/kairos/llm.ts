import { config } from '../../config/env.js';

/* One door to the language models. Providers are tried in order (the chosen one,
   then the other), so a rate limit or an outage on one side does not stop Kairos. */

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface LlmResult { text: string; provider: 'groq' | 'gemini'; model: string }
export interface LlmOptions { maxTokens?: number; temperature?: number; timeoutMs?: number }

export class LlmUnavailableError extends Error {
  constructor(public readonly attempts: string[]) {
    super(`No language model answered (${attempts.join('; ')})`);
  }
}

interface Target { provider: 'groq' | 'gemini'; model: string; key: string }

/** The providers that have a key, primary first. */
export function providerChain(cfg = config.llm): Target[] {
  const groq: Target | null = cfg.groqApiKey ? { provider: 'groq', model: cfg.groqModel, key: cfg.groqApiKey } : null;
  const gemini: Target | null = cfg.geminiApiKey ? { provider: 'gemini', model: cfg.geminiModel, key: cfg.geminiApiKey } : null;
  const ordered = cfg.provider === 'gemini' ? [gemini, groq] : [groq, gemini];
  return ordered.filter((t): t is Target => !!t);
}

export function parseGroqText(data: any): string {
  return String(data?.choices?.[0]?.message?.content ?? '').trim();
}

/** Gemini may return "thought" parts next to the answer; only the answer is kept. */
export function parseGeminiText(data: any): string {
  const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('').trim();
}

async function post(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(t: Target, system: string, messages: ChatMessage[], o: Required<LlmOptions>): Promise<string> {
  const body: Record<string, unknown> = {
    model: t.model,
    messages: [{ role: 'system', content: system }, ...messages],
    temperature: o.temperature,
    max_completion_tokens: o.maxTokens,
  };
  // gpt-oss models "think" first; a low effort keeps answers fast and leaves budget for the reply.
  if (/gpt-oss/i.test(t.model)) body.reasoning_effort = 'low';
  const data = await post('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${t.key}` },
    body: JSON.stringify(body),
  }, o.timeoutMs);
  return parseGroqText(data);
}

async function callGemini(t: Target, system: string, messages: ChatMessage[], o: Required<LlmOptions>): Promise<string> {
  const data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(t.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': t.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: o.temperature, maxOutputTokens: o.maxTokens },
    }),
  }, o.timeoutMs);
  return parseGeminiText(data);
}

export async function generate(system: string, messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
  const o: Required<LlmOptions> = { maxTokens: options.maxTokens ?? 900, temperature: options.temperature ?? 0.4, timeoutMs: options.timeoutMs ?? config.llm.timeoutMs };
  const attempts: string[] = [];
  for (const target of providerChain()) {
    try {
      const text = await (target.provider === 'groq' ? callGroq(target, system, messages, o) : callGemini(target, system, messages, o));
      if (text) return { text, provider: target.provider, model: target.model };
      attempts.push(`${target.provider}: empty answer`);
    } catch (err) {
      // The message never contains the key: errors carry only an HTTP status or "aborted".
      attempts.push(`${target.provider}: ${(err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message}`);
    }
  }
  throw new LlmUnavailableError(attempts);
}

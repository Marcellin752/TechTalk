/* The checkpoint quiz and the spaced review of what it covered. Pure rules, no database. */

export const PASS_RATIO = 0.7;
export const QUESTIONS_PER_QUIZ = 5;

export interface QuizQuestion {
  question: string;
  options: string[];
  /** Index into options. Kept on the server: the learner never receives it before answering. */
  answer: number;
  explanation: string;
  topic: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Pulls the JSON array out of a model reply, which may wrap it in a code fence or add a sentence around it. */
export function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Checks what the model produced, keeps only well-formed questions, and shuffles nothing: order matters little, correctness a lot. */
export function parseQuiz(text: string): QuizQuestion[] | null {
  const raw = extractJsonArray(text);
  if (!Array.isArray(raw)) return null;
  const out: QuizQuestion[] = [];
  for (const q of raw as Array<Record<string, unknown>>) {
    const question = clip(q?.question, 300);
    const options = Array.isArray(q?.options) ? (q.options as unknown[]).map((o) => clip(o, 160)).filter(Boolean) : [];
    const answer = Number(q?.answer);
    if (question.length < 8 || options.length !== 4 || new Set(options.map((o) => o.toLowerCase())).size !== 4) continue;
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) continue;
    out.push({ question, options, answer, explanation: clip(q?.explanation, 300), topic: clip(q?.topic, 60).toLowerCase() });
  }
  // A quiz with fewer than three good questions proves nothing.
  return out.length >= 3 ? out.slice(0, QUESTIONS_PER_QUIZ) : null;
}

/** The part of a question the learner may see. */
export const publicQuestion = (q: QuizQuestion) => ({ question: q.question, options: q.options, topic: q.topic });

export interface Graded { score: number; total: number; passed: boolean; results: Array<{ correct: boolean; chosen: number | null; answer: number; explanation: string; topic: string }> }

export function gradeQuiz(questions: QuizQuestion[], answers: unknown): Graded {
  const given = Array.isArray(answers) ? answers : [];
  const results = questions.map((q, i) => {
    const chosen = Number.isInteger(given[i]) && (given[i] as number) >= 0 && (given[i] as number) <= 3 ? (given[i] as number) : null;
    return { correct: chosen === q.answer, chosen, answer: q.answer, explanation: q.explanation, topic: q.topic };
  });
  const score = results.filter((r) => r.correct).length;
  return { score, total: questions.length, passed: questions.length > 0 && score / questions.length >= PASS_RATIO, results };
}

/** What the model is told to write. The stage's own resources ground the questions. */
export function quizPrompt(stage: { title: string; objective: string; topics?: string[] }, resources: Array<{ title: string; summary: string | null }>, level: string) {
  const system = `You write checkpoint quizzes for a learning platform. Reply with ONLY a JSON array, no prose and no code fence.
Write exactly ${QUESTIONS_PER_QUIZ} multiple-choice questions that test understanding of the CONCEPTS this stage teaches, calibrated to a ${level} learner.
Each item: {"question": string, "options": [4 distinct strings], "answer": index 0-3 of the correct option, "explanation": one or two sentences saying why, "topic": a short lower-case topic}.
Rules: one clearly correct option, plausible wrong ones; vary the position of the correct answer; do not ask who wrote a resource or what it is called; do not ask trivia; questions must stand on their own; write in English.`;
  const user = `Stage: ${stage.title}\nObjective: ${stage.objective}\n${stage.topics?.length ? `Topics: ${stage.topics.join(', ')}\n` : ''}Resources the learner went through:\n${resources.map((r) => `- ${r.title}${r.summary ? `: ${r.summary.slice(0, 160)}` : ''}`).join('\n')}`;
  return { system, user };
}

/* ---- spaced review (Leitner boxes) ---- */

export const BOX_DAYS = [1, 3, 7, 16, 35];
export const MAX_BOX = BOX_DAYS.length;

/** After an answer: right moves the card up a box (seen less often), wrong sends it back to box 1. */
export function nextReview(box: number, correct: boolean, now = new Date()): { box: number; dueAt: Date } {
  const nextBox = correct ? Math.min(MAX_BOX, box + 1) : 1;
  return { box: nextBox, dueAt: new Date(now.getTime() + BOX_DAYS[nextBox - 1]! * 86_400_000) };
}

/** Where a card starts after a quiz: missed questions come back tomorrow, answered ones in three days. */
export const firstReview = (correct: boolean, now = new Date()) => nextReview(correct ? 1 : 0, correct, now);

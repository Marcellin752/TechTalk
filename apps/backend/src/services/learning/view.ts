import type { PathSettings, PathStage } from '../../db/schema.js';

export interface StepRow {
  id: string;
  position: number;
  stage: number;
  kind: string;
  minutes: number;
  status: string;
  verifiedBy?: string | null;
  completedAt: Date | null;
  content: {
    id: string;
    type: string;
    title: string;
    url: string;
    source: string;
    summary: string | null;
    image: string | null;
    meta: Record<string, unknown> | null;
  };
}

export interface PathRow {
  id: string;
  title: string;
  goal: string;
  level: string;
  hoursPerWeek: number;
  totalMinutes: number;
  stages: PathStage[];
  createdAt: Date;
  kind?: string;
  active?: boolean;
  settings?: PathSettings | null;
}

/** Groups steps into stages and computes progress: what is done, what is next, how long is left. */
export interface QuizState { id: string; passedAt: Date | null; bestScore: number | null; attempts: number; total: number }

export function assemblePathView(path: PathRow, steps: StepRow[], quizzes: Map<number, QuizState> = new Map()) {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const stages = path.stages.map((stage) => {
    const own = ordered.filter((s) => s.stage === stage.index);
    const done = own.filter((s) => s.status === 'done').length;
    const quiz = quizzes.get(stage.index);
    // The checkpoint: a stage is "passed" once its quiz is. It needs every step done to be taken.
    const checkpoint = { quizId: quiz?.id ?? null, passed: !!quiz?.passedAt, bestScore: quiz?.bestScore ?? null, total: quiz?.total ?? null, attempts: quiz?.attempts ?? 0 };
    return { ...stage, steps: own, done, total: own.length, complete: own.length > 0 && done === own.length, checkpoint };
  });

  const doneSteps = ordered.filter((s) => s.status === 'done');
  const minutesDone = doneSteps.reduce((n, s) => n + s.minutes, 0);
  const minutesTotal = ordered.reduce((n, s) => n + s.minutes, 0);
  const next = ordered.find((s) => s.status === 'doing') ?? ordered.find((s) => s.status !== 'done') ?? null;
  const currentStage = next ? next.stage : null;
  const perWeek = Math.max(1, path.hoursPerWeek) * 60;

  return {
    id: path.id,
    title: path.title,
    goal: path.goal,
    level: path.level,
    hoursPerWeek: path.hoursPerWeek,
    createdAt: path.createdAt,
    kind: path.kind ?? 'personal',
    active: path.active ?? true,
    schoolYear: path.settings?.schoolYear ?? null,
    programmeDraft: path.settings?.programmeDraft ?? false,
    stages,
    currentStage,
    next,
    progress: {
      doneSteps: doneSteps.length,
      totalSteps: ordered.length,
      percent: minutesTotal ? Math.round((minutesDone / minutesTotal) * 100) : 0,
      minutesDone,
      minutesTotal,
      weeksLeft: Math.ceil((minutesTotal - minutesDone) / perWeek),
      weeksTotal: Math.ceil(minutesTotal / perWeek),
    },
  };
}

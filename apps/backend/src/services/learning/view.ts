import type { PathStage } from '../../db/schema.js';

export interface StepRow {
  id: string;
  position: number;
  stage: number;
  kind: string;
  minutes: number;
  status: string;
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
}

/** Groups steps into stages and computes progress: what is done, what is next, how long is left. */
export function assemblePathView(path: PathRow, steps: StepRow[]) {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const stages = path.stages.map((stage) => {
    const own = ordered.filter((s) => s.stage === stage.index);
    const done = own.filter((s) => s.status === 'done').length;
    return { ...stage, steps: own, done, total: own.length, complete: own.length > 0 && done === own.length };
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

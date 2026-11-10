/* What to do next, and why. A plain rule list, so the learner can read the reasoning and disagree with it. */

export interface NextContext {
  dueReviews: number;
  dueCards: number;
  nextStep: { title: string; pathId: string } | null;
  deadline: { title: string; inDays: number } | null;
  weak: Array<{ slug: string; name: string }>;
  ready: Array<{ slug: string; name: string }>;
  streak: number;
  doneToday: number;
  /** A project they are building that still has a milestone to do. */
  project?: { title: string; milestone: string } | null;
  mentorRequests?: number;
}
export interface NextAction { id: string; kind: 'review' | 'cards' | 'step' | 'deadline' | 'strengthen' | 'learn' | 'project' | 'mentor'; title: string; reason: string; link: string; priority: number }

export function nextActions(c: NextContext): NextAction[] {
  const out: NextAction[] = [];
  if (c.deadline && c.deadline.inDays <= 7) out.push({ id: 'deadline', kind: 'deadline', title: c.deadline.title, reason: c.deadline.inDays <= 0 ? 'due today' : `due in ${c.deadline.inDays} day${c.deadline.inDays === 1 ? '' : 's'}`, link: '/calendar', priority: 100 - c.deadline.inDays });
  if (c.dueReviews + c.dueCards > 0) {
    const n = c.dueReviews + c.dueCards;
    out.push({ id: 'review', kind: c.dueReviews ? 'review' : 'cards', title: `${n} card${n === 1 ? '' : 's'} to review`, reason: 'reviewing at the right time is what makes it stick', link: c.dueReviews ? '/review' : '/memory', priority: 80 });
  }
  if (c.weak[0]) out.push({ id: `strengthen:${c.weak[0].slug}`, kind: 'strengthen', title: `Strengthen ${c.weak[0].name}`, reason: 'your last answers on it were shaky', link: `/skills/${c.weak[0].slug}`, priority: 70 });
  if (c.nextStep) out.push({ id: 'step', kind: 'step', title: c.nextStep.title, reason: c.doneToday === 0 ? (c.streak > 0 ? `keeps your ${c.streak}-day streak alive` : 'the next step of your path') : 'the next step of your path', link: '/path', priority: c.doneToday === 0 ? 75 : 50 });
  if (c.mentorRequests) out.push({ id: 'mentor', kind: 'mentor', title: `${c.mentorRequests} mentoring request${c.mentorRequests === 1 ? '' : 's'} waiting`, reason: 'someone is counting on your answer', link: '/community', priority: 60 });
  if (c.project) out.push({ id: 'project', kind: 'project', title: `${c.project.title}: ${c.project.milestone}`, reason: 'the next milestone of the project you are building', link: '/lab', priority: 45 });
  if (c.ready[0]) out.push({ id: `learn:${c.ready[0].slug}`, kind: 'learn', title: `Start ${c.ready[0].name}`, reason: 'you know what it needs first', link: `/skills/${c.ready[0].slug}`, priority: 40 });
  return out.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

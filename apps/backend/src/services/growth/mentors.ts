/* Mentors are matched on what they have shown, not on what they say: a topic they offer counts only if the evidence reaches "understood". */

import type { Level as SkillLevel } from '../skills/mastery.js';

export const canTeach = (level: SkillLevel) => level === 'understood' || level === 'applied';

export interface MentorCandidate { userId: string; offering: string[]; levels: Record<string, SkillLevel> }

export function matchMentors(topic: string, candidates: MentorCandidate[], me: string): Array<{ userId: string; level: SkillLevel }> {
  return candidates
    .filter((c) => c.userId !== me && c.offering.includes(topic) && canTeach(c.levels[topic] ?? 'unseen'))
    .map((c) => ({ userId: c.userId, level: c.levels[topic]! }))
    .sort((a, b) => Number(b.level === 'applied') - Number(a.level === 'applied'));
}

import { atLeast, type Level } from './mastery.js';

/* The shape of a learner's knowledge: which concepts depend on which, where they stand, and what to learn next. */

export interface GNode { slug: string; level: Level }
export interface GEdge { id?: string; from: string; to: string; type: 'prerequisite' | 'related' }

/** Prerequisite depth of each concept: 0 for those with none, else one more than their deepest prerequisite. Cycles are cut rather than looped on. */
export function depths(nodes: string[], edges: GEdge[]): Map<string, number> {
  const known = new Set(nodes);
  const req = new Map<string, string[]>();
  for (const e of edges) if (e.type === 'prerequisite' && known.has(e.from) && known.has(e.to)) req.set(e.to, [...(req.get(e.to) ?? []), e.from]);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (n: string): number => {
    if (memo.has(n)) return memo.get(n)!;
    if (visiting.has(n)) return 0;
    visiting.add(n);
    const d = Math.max(-1, ...(req.get(n) ?? []).map(depth)) + 1;
    visiting.delete(n);
    memo.set(n, d);
    return d;
  };
  for (const n of nodes) depth(n);
  return memo;
}

/** True when the graph has a prerequisite cycle (which would make "learn this first" meaningless). */
export function hasPrerequisiteCycle(nodes: string[], edges: GEdge[]): boolean {
  const next = new Map<string, string[]>();
  for (const e of edges) if (e.type === 'prerequisite') next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const state = new Map<string, 1 | 2>();
  const visit = (n: string): boolean => {
    if (state.get(n) === 2) return false;
    if (state.get(n) === 1) return true;
    state.set(n, 1);
    for (const m of next.get(n) ?? []) if (visit(m)) return true;
    state.set(n, 2);
    return false;
  };
  return nodes.some(visit);
}

/**
 * What to learn next: concepts the learner has not understood yet whose prerequisites they have.
 * Concepts already being learned come first (finish what you started), then the rest by name.
 */
export function readyToLearn(nodes: GNode[], edges: GEdge[]): string[] {
  const level = new Map(nodes.map((n) => [n.slug, n.level]));
  const reqs = new Map<string, string[]>();
  for (const e of edges) if (e.type === 'prerequisite') reqs.set(e.to, [...(reqs.get(e.to) ?? []), e.from]);
  return nodes
    .filter((n) => !atLeast(n.level, 'understood'))
    .filter((n) => (reqs.get(n.slug) ?? []).every((r) => atLeast(level.get(r) ?? 'unseen', 'understood')))
    .sort((a, b) => Number(b.level === 'learning') - Number(a.level === 'learning') || a.slug.localeCompare(b.slug))
    .map((n) => n.slug);
}

/** The prerequisites of a concept the learner has not understood yet, the deepest first (the ones to learn first). */
export function missingPrerequisites(slug: string, nodes: GNode[], edges: GEdge[]): string[] {
  const level = new Map(nodes.map((n) => [n.slug, n.level]));
  const all = new Set(nodes.map((n) => n.slug));
  const d = depths([...all], edges);
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (s: string) => {
    for (const e of edges) {
      if (e.type !== 'prerequisite' || e.to !== s || seen.has(e.from)) continue;
      seen.add(e.from);
      if (!atLeast(level.get(e.from) ?? 'unseen', 'understood')) out.push(e.from);
      walk(e.from);
    }
  };
  walk(slug);
  return out.sort((a, b) => (d.get(a) ?? 0) - (d.get(b) ?? 0) || a.localeCompare(b));
}

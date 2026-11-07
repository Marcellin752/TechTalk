import type { KairosConversation } from "../services/api";

export type HistoryGroup = "today" | "yesterday" | "week" | "older";
export const GROUP_ORDER: HistoryGroup[] = ["today", "yesterday", "week", "older"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Where a conversation belongs in the history, by the day it was last used. */
export function groupOf(iso: string, now = new Date()): HistoryGroup {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? "week" : "older";
}

/** Conversations matching the search, newest first, in groups (empty groups left out). */
export function groupHistory(list: KairosConversation[], query = "", now = new Date()): Array<{ group: HistoryGroup; items: KairosConversation[] }> {
  const q = query.trim().toLowerCase();
  const kept = [...list].filter((c) => !q || c.title.toLowerCase().includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return GROUP_ORDER.map((group) => ({ group, items: kept.filter((c) => groupOf(c.updatedAt, now) === group) })).filter((g) => g.items.length > 0);
}

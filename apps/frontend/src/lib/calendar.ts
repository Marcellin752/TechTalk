import type { CalendarEvent, CalendarKind } from "../services/api";

/** The 42 days (6 weeks, Monday first) a month view shows. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - lead + i));
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Events grouped by the local day they start on, in time order. */
export function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = dayKey(new Date(e.startsAt));
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
}

/** "2030-01-08" and "18:30" from a date, for <input type="date|time">. */
export const toDateInput = (d: Date) => dayKey(d);
export const toTimeInput = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Local date + time inputs back to a Date; null when either is missing or invalid. */
export function fromInputs(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const KIND_STYLE: Record<CalendarKind, { dot: string; chip: string }> = {
  study: { dot: "bg-primary", chip: "bg-primary/15 text-primary" },
  school: { dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  deadline: { dot: "bg-red-500", chip: "bg-red-500/15 text-red-600 dark:text-red-400" },
  event: { dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

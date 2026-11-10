import { KINDS, parseSchoolEvent, type SchoolEventInput } from './schools.js';

/* Loading a school's deadlines from what it already has: a calendar export (.ics) or a spreadsheet (.csv). */

export interface ImportResult { events: SchoolEventInput[]; errors: string[] }

/** Splits one CSV line, honouring double quotes. */
function csvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"', i++);
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) (out.push(cur), (cur = ''));
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * Columns (header row required, any order): title, start, end, and optionally kind, year, notes, id.
 * Dates are ISO 8601. A missing end defaults to one hour after the start; a missing kind to "deadline".
 */
export function parseCsvEvents(text: string): ImportResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { events: [], errors: ['The file needs a header row and at least one event.'] };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const head = csvLine(lines[0]!, sep).map((h) => h.toLowerCase());
  const col = (name: string) => head.indexOf(name);
  for (const need of ['title', 'start']) if (col(need) === -1) return { events: [], errors: [`The header row needs a "${need}" column.`] };
  const events: SchoolEventInput[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = csvLine(line, sep);
    const get = (n: string) => (col(n) === -1 ? '' : cells[col(n)] ?? '');
    const start = new Date(get('start'));
    const end = get('end') ? new Date(get('end')) : Number.isNaN(start.getTime()) ? start : new Date(start.getTime() + 3_600_000);
    const kind = (get('kind') || 'deadline').toLowerCase();
    const r = parseSchoolEvent({
      externalId: get('id') || `${slug(get('title'))}-${Number.isNaN(start.getTime()) ? i : start.toISOString().slice(0, 10)}`,
      title: get('title'), kind: (KINDS as readonly string[]).includes(kind) ? kind : 'deadline',
      startsAt: Number.isNaN(start.getTime()) ? get('start') : start.toISOString(), endsAt: Number.isNaN(end.getTime()) ? get('end') : end.toISOString(),
      notes: get('notes') || null, year: get('year') ? Number(get('year')) : null,
    });
    if (r.ok) events.push(r.event);
    else errors.push(`Line ${i + 2}: ${r.error}`);
  });
  return { events, errors };
}

const unfold = (ics: string) => ics.replace(/\r?\n[ \t]/g, '');
const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** iCalendar date: 20300108T090000Z, 20300108T090000 (read as UTC) or 20300108 (all day). */
function icsDate(v: string): Date | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
}

/** Reads the VEVENTs of a calendar export. The UID becomes the event's id, so importing again updates instead of duplicating. */
export function parseIcsEvents(text: string): ImportResult {
  const events: SchoolEventInput[] = [];
  const errors: string[] = [];
  const blocks = unfold(text).split(/BEGIN:VEVENT/i).slice(1);
  if (blocks.length === 0) return { events, errors: ['No event found: is this an .ics file?'] };
  blocks.forEach((block, i) => {
    const body = block.split(/END:VEVENT/i)[0]!;
    const prop = (name: string) => body.match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, 'im'))?.[1]?.trim() ?? '';
    const start = icsDate(prop('DTSTART'));
    const end = icsDate(prop('DTEND')) ?? (start ? new Date(start.getTime() + 3_600_000) : null);
    const category = (prop('CATEGORIES').split(',')[0] ?? '').toLowerCase();
    const r = parseSchoolEvent({
      externalId: (prop('UID') || `${slug(prop('SUMMARY'))}-${i}`).replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 100),
      title: unescape(prop('SUMMARY')), kind: (KINDS as readonly string[]).includes(category) ? category : 'deadline',
      startsAt: start?.toISOString() ?? '', endsAt: end?.toISOString() ?? '', notes: unescape(prop('DESCRIPTION')).slice(0, 500) || null, year: null,
    });
    if (r.ok) events.push(r.event);
    else errors.push(`Event ${i + 1}: ${r.error}`);
  });
  return { events, errors };
}

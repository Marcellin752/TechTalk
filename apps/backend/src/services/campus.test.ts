import { describe, it, expect } from 'vitest';
import { isSafeUrl, parseCampusProfile, parseResource, parseSession, rankPeople, sharedTopics } from './campus.js';

const now = new Date('2030-01-07T10:00:00Z');

describe('isSafeUrl', () => {
  it('accepts public http(s) addresses', () => {
    expect(isSafeUrl('https://drive.google.com/file/d/abc')).toBe(true);
    expect(isSafeUrl('http://example.org/exam.pdf')).toBe(true);
  });
  it.each([
    'javascript:alert(1)', 'data:text/html,<b>x', 'file:///etc/passwd', 'ftp://example.org/x', 'http://localhost/x', 'http://127.0.0.1/x',
    'http://192.168.0.4/x', 'http://[::1]/x', 'https://user:pw@example.org/x', 'https://intranet/x', 'https://printer.local/x', 'not a url', '',
  ])('refuses %s', (u) => expect(isSafeUrl(u)).toBe(false));
  it('refuses non-strings and huge links', () => {
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl('https://example.org/' + 'a'.repeat(600))).toBe(false);
  });
});

describe('parseResource', () => {
  const ok = { title: ' C exam 2025 ', kind: 'exam', subject: ' C  programming ', year: 2025, studyYear: 1, url: 'https://drive.example.org/x' };
  it('cleans and accepts a good one', () => {
    const r = parseResource(ok, now);
    expect(r.ok && r.value).toMatchObject({ title: 'C exam 2025', subject: 'C programming', year: 2025, studyYear: 1, description: null });
  });
  it('allows a one-letter subject such as C', () => {
    expect(parseResource({ ...ok, subject: 'C' }, now).ok).toBe(true);
  });
  it('refuses bad input with a reason', () => {
    expect(parseResource({ ...ok, title: 'ab' }, now).ok).toBe(false);
    expect(parseResource({ ...ok, kind: 'meme' }, now).ok).toBe(false);
    expect(parseResource({ ...ok, subject: ' ' }, now).ok).toBe(false);
    expect(parseResource({ ...ok, url: 'javascript:1' }, now).ok).toBe(false);
    expect(parseResource({ ...ok, year: 1999 }, now).ok).toBe(false);
    expect(parseResource({ ...ok, year: 2040 }, now).ok).toBe(false);
    expect(parseResource({ ...ok, studyYear: 12 }, now).ok).toBe(false);
    expect(parseResource(null, now).ok).toBe(false);
  });
  it('treats the optional fields as optional', () => {
    const { year: _y, studyYear: _s, ...rest } = ok;
    const r = parseResource(rest, now);
    expect(r.ok && r.value.year).toBeNull();
    expect(r.ok && r.value.studyYear).toBeNull();
  });
});

describe('parseSession', () => {
  const start = '2030-01-08T18:00:00Z';
  const end = '2030-01-08T20:00:00Z';
  const ok = { title: 'Pointers night', subject: 'C', place: 'Library', startsAt: start, endsAt: end };
  it('accepts a session with a place and defaults to 8 places', () => {
    const r = parseSession(ok, now);
    expect(r.ok && r.value.capacity).toBe(8);
  });
  it('accepts an online-only session', () => {
    expect(parseSession({ ...ok, place: '', onlineUrl: 'https://meet.example.org/a' }, now).ok).toBe(true);
  });
  it('needs a place or an online link', () => {
    expect(parseSession({ ...ok, place: '' }, now).ok).toBe(false);
  });
  it('refuses the past, backwards times, marathons and the far future', () => {
    expect(parseSession({ ...ok, startsAt: '2030-01-06T10:00:00Z', endsAt: '2030-01-06T12:00:00Z' }, now).ok).toBe(false);
    expect(parseSession({ ...ok, endsAt: '2030-01-08T17:00:00Z' }, now).ok).toBe(false);
    expect(parseSession({ ...ok, endsAt: '2030-01-09T18:00:00Z' }, now).ok).toBe(false);
    expect(parseSession({ ...ok, startsAt: '2031-01-08T18:00:00Z', endsAt: '2031-01-08T19:00:00Z' }, now).ok).toBe(false);
  });
  it('bounds the places and checks the online link', () => {
    expect(parseSession({ ...ok, capacity: 1 }, now).ok).toBe(false);
    expect(parseSession({ ...ok, capacity: 51 }, now).ok).toBe(false);
    expect(parseSession({ ...ok, capacity: 2.5 }, now).ok).toBe(false);
    expect(parseSession({ ...ok, onlineUrl: 'javascript:1' }, now).ok).toBe(false);
  });
});

describe('parseCampusProfile', () => {
  it('accepts partial updates', () => {
    expect(parseCampusProfile({ discoverable: true })).toEqual({ ok: true, value: { discoverable: true } });
    expect(parseCampusProfile({ headline: '  Hello  world ', lookingFor: 'mentor', contact: '@alex#1234' })).toEqual({ ok: true, value: { headline: 'Hello world', lookingFor: 'mentor', contact: '@alex#1234' } });
  });
  it('refuses a link as a contact and unknown values', () => {
    expect(parseCampusProfile({ contact: 'https://evil.example' }).ok).toBe(false);
    expect(parseCampusProfile({ contact: '<script>' }).ok).toBe(false);
    expect(parseCampusProfile({ lookingFor: 'date' }).ok).toBe(false);
    expect(parseCampusProfile({ discoverable: 'yes' }).ok).toBe(false);
  });
  it('lets fields be cleared', () => {
    expect(parseCampusProfile({ headline: '', contact: '', lookingFor: null })).toEqual({ ok: true, value: { headline: null, contact: null, lookingFor: null } });
  });
});

describe('matching people', () => {
  it('finds shared topics regardless of case and spacing', () => {
    expect(sharedTopics(['C', 'Unix', 'git'], ['unix', 'c', 'rust'])).toEqual(['unix', 'c']);
  });

  it('ranks shared topics first, then the same year, then the same wish', () => {
    const me = { year: 1, topics: ['c', 'unix', 'git'], lookingFor: 'study-buddy' };
    const people = [
      { userId: 'none', year: 1, topics: ['rust'], lookingFor: 'study-buddy' },
      { userId: 'two', year: 3, topics: ['c', 'unix'], lookingFor: null },
      { userId: 'one-same-year', year: 1, topics: ['git'], lookingFor: null },
      { userId: 'three', year: 2, topics: ['c', 'unix', 'git'], lookingFor: null },
    ];
    const ranked = rankPeople(me, people);
    expect(ranked.map((p) => p.userId)).toEqual(['three', 'two', 'one-same-year', 'none']);
    expect(ranked[0]!.shared).toEqual(['c', 'unix', 'git']);
  });
});

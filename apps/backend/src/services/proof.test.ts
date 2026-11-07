import { describe, it, expect, vi } from 'vitest';
import { firstReview, gradeQuiz, nextReview, parseQuiz, publicQuestion, quizPrompt, PASS_RATIO, BOX_DAYS } from './learning/quiz.js';
import { kataKey, matchSolved, fetchSolved, CODEWARS_USER } from './codewars.js';
import { parseCsvEvents, parseIcsEvents } from './events-import.js';
import { classChallenge, computeStreak, localDay, weekStart, weeklyGoal } from './learning/habits.js';
import { rankOpportunities, stageOf, looksLikeInternship, type Opportunity } from './learning/opportunities.js';
import { splitDirectives } from './kairos/actions.js';
import { eventMatchesStage, titleKeys } from '../controllers/habits.controller.js';

vi.mock('../db/db.js', () => ({ db: {} }));

const good = (n: number) => ({ question: `What does concept number ${n} do in practice?`, options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`], answer: n % 4, explanation: 'Because.', topic: 'Pointers' });

describe('quiz parsing', () => {
  it('reads a clean JSON array', () => {
    const q = parseQuiz(JSON.stringify([good(1), good(2), good(3), good(4), good(5)]));
    expect(q).toHaveLength(5);
    expect(q![0]!.topic).toBe('pointers');
  });
  it('reads one wrapped in a code fence and chatter', () => {
    const q = parseQuiz('Here you go:\n```json\n' + JSON.stringify([good(1), good(2), good(3)]) + '\n```\nEnjoy!');
    expect(q).toHaveLength(3);
  });
  it('drops malformed questions and refuses a quiz with too few left', () => {
    const bad = [{ question: 'short', options: ['a', 'b', 'c', 'd'], answer: 0 }, { ...good(2), options: ['a', 'a', 'b', 'c'] }, { ...good(3), answer: 7 }, { ...good(4), options: ['x', 'y'] }, good(5)];
    expect(parseQuiz(JSON.stringify(bad))).toBeNull();
    expect(parseQuiz('not json at all')).toBeNull();
    expect(parseQuiz('{"a":1}')).toBeNull();
  });
  it('keeps at most five questions', () => {
    expect(parseQuiz(JSON.stringify(Array.from({ length: 9 }, (_, i) => good(i + 1))))).toHaveLength(5);
  });
  it('never gives the answer to the learner before they answer', () => {
    const pub = publicQuestion(good(1) as never);
    expect(Object.keys(pub).sort()).toEqual(['options', 'question', 'topic']);
  });
  it('asks the model to ground the quiz in the stage and not ask trivia', () => {
    const p = quizPrompt({ title: 'Minishell', objective: 'Write a shell', topics: ['c', 'unix'] }, [{ title: 'The Linux Command Line', summary: 'A book' }], 'basics');
    expect(p.system).toMatch(/ONLY a JSON array/);
    expect(p.system).toMatch(/not ask who wrote/);
    expect(p.user).toMatch(/Minishell/);
    expect(p.user).toMatch(/The Linux Command Line/);
  });
});

describe('grading', () => {
  const qs = [good(1), good(2), good(3), good(4), good(5)] as never[];
  it('counts right answers and applies the pass mark', () => {
    const g = gradeQuiz(qs, [1, 2, 3, 0, 0]);
    expect(g.score).toBe(4); // answers are n % 4 => 1,2,3,0,1 : the last one is wrong
    expect(g.passed).toBe(4 / 5 >= PASS_RATIO);
    expect(g.results[4]!.correct).toBe(false);
    expect(g.results[4]!.answer).toBe(1);
  });
  it('fails below the mark and treats blanks and junk as wrong', () => {
    expect(gradeQuiz(qs, [1, 2, null, undefined, 'x']).passed).toBe(false);
    expect(gradeQuiz(qs, 'nope').score).toBe(0);
    expect(gradeQuiz(qs, [9, 9, 9, 9, 9]).results.every((r) => r.chosen === null)).toBe(true);
  });
  it('a quiz with no questions is never passed', () => {
    expect(gradeQuiz([], []).passed).toBe(false);
  });
});

describe('spaced review', () => {
  const now = new Date('2030-01-01T10:00:00Z');
  it('moves a correct card up a box and sees it later', () => {
    const r = nextReview(2, true, now);
    expect(r.box).toBe(3);
    expect(r.dueAt.getTime() - now.getTime()).toBe(BOX_DAYS[2]! * 86_400_000);
  });
  it('sends a wrong card back to the first box, due tomorrow', () => {
    const r = nextReview(4, false, now);
    expect(r.box).toBe(1);
    expect(r.dueAt.getTime() - now.getTime()).toBe(86_400_000);
  });
  it('stops at the last box', () => expect(nextReview(5, true, now).box).toBe(5));
  it('starts missed questions tomorrow and answered ones later', () => {
    expect(firstReview(false, now).dueAt < firstReview(true, now).dueAt).toBe(true);
  });
});

describe('codewars', () => {
  it('reads a kata id or slug from a link', () => {
    expect(kataKey('https://www.codewars.com/kata/5266876b8f4bf2da9b000362')).toBe('5266876b8f4bf2da9b000362');
    expect(kataKey('https://www.codewars.com/kata/human-readable-time/python')).toBe('human-readable-time');
    expect(kataKey('https://example.org/x')).toBeNull();
  });
  it('finds the steps whose kata is solved, by id or slug', () => {
    const steps = [{ id: 's1', url: 'https://www.codewars.com/kata/5266876b8f4bf2da9b000362' }, { id: 's2', url: 'https://www.codewars.com/kata/other-one' }, { id: 's3', url: 'https://www.codewars.com/kata/not-solved' }, { id: 's4', url: 'https://example.org' }];
    expect(matchSolved(steps, [{ id: '5266876B8F4BF2DA9B000362', slug: 'x', completedAt: '' }, { id: 'zz', slug: 'other-one', completedAt: '' }])).toEqual(['s1', 's2']);
  });
  it('validates usernames', () => {
    expect(CODEWARS_USER.test('alex_m-1')).toBe(true);
    expect(CODEWARS_USER.test('a')).toBe(false);
    expect(CODEWARS_USER.test('../etc')).toBe(false);
    expect(CODEWARS_USER.test('x y')).toBe(false);
  });
  it('reads pages until the last and reports an unknown user', async () => {
    const pages = [{ totalPages: 2, data: [{ id: 'a', slug: 'a-1' }] }, { totalPages: 2, data: [{ id: 'b', slug: 'b-1' }, { slug: 'broken' }] }];
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(pages[Number(new URL(url).searchParams.get('page'))]), { status: 200 })) as unknown as typeof fetch;
    expect((await fetchSolved('alex', f)).map((s) => s.id)).toEqual(['a', 'b']);
    await expect(fetchSolved('ghost', (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).rejects.toThrow('not_found');
  });
});

describe('importing deadlines', () => {
  it('reads a CSV, with quotes, either separator and defaults', () => {
    const r = parseCsvEvents('title,start,end,kind,year,notes\n"Zappy, final delivery",2030-02-10T09:00:00Z,2030-02-10T18:00:00Z,deadline,2,"Bring a demo"\nPiscine exam,2030-01-08T08:00:00Z,,school,,');
    expect(r.errors).toEqual([]);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]).toMatchObject({ title: 'Zappy, final delivery', kind: 'deadline', year: 2, notes: 'Bring a demo' });
    expect(r.events[1]!.endsAt.getTime() - r.events[1]!.startsAt.getTime()).toBe(3_600_000);
    expect(parseCsvEvents('title;start\nExam;2030-01-08T08:00:00Z').events).toHaveLength(1);
  });
  it('gives stable ids so importing twice updates rather than duplicates', () => {
    const csv = 'title,start\nZappy,2030-02-10T09:00:00Z';
    expect(parseCsvEvents(csv).events[0]!.externalId).toBe(parseCsvEvents(csv).events[0]!.externalId);
  });
  it('reports bad lines with their number and keeps the good ones', () => {
    const r = parseCsvEvents('title,start,end\nGood,2030-01-08T08:00:00Z,2030-01-08T09:00:00Z\nBad,not a date,\nBackwards,2030-01-08T09:00:00Z,2030-01-08T08:00:00Z');
    expect(r.events).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/Line 3/);
  });
  it('refuses a file without the needed columns', () => {
    expect(parseCsvEvents('name,when\nx,y').errors[0]).toMatch(/"title"/);
    expect(parseCsvEvents('title,start').errors[0]).toMatch(/header row/);
  });
  it('reads an .ics export, using the UID as the id', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:abc-123@epitech', 'DTSTART:20300210T090000Z', 'DTEND:20300210T180000Z', 'SUMMARY:Zappy\\, final delivery', 'DESCRIPTION:Bring a demo\\nand slides', 'CATEGORIES:deadline', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:day-2', 'DTSTART;VALUE=DATE:20300301', 'SUMMARY:Open day', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const r = parseIcsEvents(ics);
    expect(r.errors).toEqual([]);
    expect(r.events.map((e) => e.externalId)).toEqual(['abc-123-epitech', 'day-2']);
    expect(r.events[0]).toMatchObject({ title: 'Zappy, final delivery', kind: 'deadline', notes: 'Bring a demo\nand slides' });
    expect(r.events[0]!.startsAt.toISOString()).toBe('2030-02-10T09:00:00.000Z');
  });
  it('unfolds long lines and rejects a file with no event', () => {
    expect(parseIcsEvents('BEGIN:VEVENT\r\nUID:u\r\nDTSTART:20300210T090000Z\r\nSUMMARY:A very long\r\n  title here\r\nEND:VEVENT').events[0]!.title).toBe('A very long title here');
    expect(parseIcsEvents('hello').errors[0]).toMatch(/No event/);
  });
});

describe('streaks and the week', () => {
  it('counts consecutive days, keeping yesterday alive until the day is over', () => {
    const s = computeStreak(['2030-01-05', '2030-01-06', '2030-01-07'], '2030-01-08');
    expect(s.current).toBe(3);
    expect(s.todayDone).toBe(false);
    expect(computeStreak(['2030-01-05', '2030-01-06', '2030-01-07', '2030-01-08'], '2030-01-08').current).toBe(4);
  });
  it('breaks after a missed day and remembers the best', () => {
    const s = computeStreak(['2030-01-01', '2030-01-02', '2030-01-03', '2030-01-04', '2030-01-07'], '2030-01-08');
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
    expect(computeStreak([], '2030-01-08')).toMatchObject({ current: 0, best: 0 });
  });
  it('shows the last seven days', () => {
    const s = computeStreak(['2030-01-08'], '2030-01-08');
    expect(s.week).toHaveLength(7);
    expect(s.week[6]).toEqual({ date: '2030-01-08', active: true });
    expect(s.week[0]!.date).toBe('2030-01-02');
  });
  it('works out the learner\'s day and week from their time zone', () => {
    expect(localDay(new Date('2030-01-08T23:30:00Z'), -60)).toBe('2030-01-09'); // Paris is ahead of UTC
    expect(localDay(new Date('2030-01-08T00:30:00Z'), 300)).toBe('2030-01-07');
    expect(weekStart('2030-01-08')).toBe('2030-01-07'); // a Tuesday: the Monday before
    expect(weekStart('2030-01-13')).toBe('2030-01-07'); // a Sunday
  });
  it('measures the week against the learner\'s own time', () => {
    expect(weeklyGoal(180, 6)).toEqual({ target: 360, done: 180, percent: 50, reached: false });
    expect(weeklyGoal(400, 6).reached).toBe(true);
    expect(weeklyGoal(0, 0).target).toBe(30);
  });
  it('shares class totals only from five students up', () => {
    expect(classChallenge([100, 200, 300, 50], [10, 10, 10, 10])).toBeNull();
    const c = classChallenge([120, 200, 300, 50, 600], [100, 100, 100, 100, 100])!;
    expect(c.students).toBe(5);
    expect(c.changePercent).toBe(Math.round(((1270 - 500) / 500) * 100));
    expect(classChallenge([10, 10, 10, 10, 10], [0, 0, 0, 0, 0])!.changePercent).toBeNull();
  });
});

describe('opportunities', () => {
  const o = (id: string, title: string, meta: Record<string, any> = {}, extra: Partial<Opportunity> = {}): Opportunity => ({ id, title, summary: '', url: `https://x.org/${id}`, source: 'src', meta, categories: [], ...extra });
  const items = [
    o('issue-c', 'Fix a leak in the C parser', { kind: 'issue', labels: ['good first issue', 'c'], language: 'C' }),
    o('job-senior', 'Senior Python engineer', { kind: 'job', jobType: 'full_time' }),
    o('intern-py', 'Software engineering intern (Python)', { kind: 'job', jobType: 'internship' }),
    o('nothing', 'Marketing manager', { kind: 'job' }),
  ];
  it('shows nothing that matches no skill', () => {
    expect(rankOpportunities(items, ['rust'], 2)).toEqual([]);
    expect(rankOpportunities(items, ['python'], 2).map((x) => x.id)).not.toContain('nothing');
  });
  it('tells which skills matched', () => {
    const r = rankOpportunities(items, ['c', 'python'], 1);
    expect(r.find((x) => x.id === 'issue-c')!.matched).toEqual(['c']);
  });
  it('favours issues early on, internships in the middle, jobs at the end', () => {
    const skills = ['python', 'c'];
    expect(rankOpportunities(items, skills, 1)[0]!.id).toBe('issue-c');
    expect(rankOpportunities(items, skills, 3).find((x) => x.id === 'intern-py')!.score).toBeGreaterThan(rankOpportunities(items, skills, 3).find((x) => x.id === 'job-senior')!.score);
    const late = rankOpportunities(items, skills, 5);
    expect(late.find((x) => x.id === 'job-senior')!.score).toBeGreaterThan(late.find((x) => x.id === 'issue-c')!.score - 1);
  });
  it('recognises internships and school years', () => {
    expect(looksLikeInternship(o('a', 'Stage développeur web'))).toBe(true);
    expect(looksLikeInternship(o('a', 'Staff engineer'))).toBe(false);
    expect([stageOf(null), stageOf(1), stageOf(2), stageOf(3), stageOf(5)]).toEqual(['early', 'early', 'mid', 'mid', 'late']);
  });
});

describe('what Kairos may propose', () => {
  const soon = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  it('separates proposed actions and notes from the text the learner reads', () => {
    const raw = `Here is a plan.\n@@ACTION {"type":"calendar.add","title":"Review pointers","startsAt":"${soon(24)}","endsAt":"${soon(26)}"}\n@@ACTION {"type":"plan.sessions"}\n@@NOTE Struggles with pointer arithmetic`;
    const p = splitDirectives(raw);
    expect(p.text).toBe('Here is a plan.');
    expect(p.actions.map((a) => a.type)).toEqual(['calendar.add', 'plan.sessions']);
    expect(p.notes).toEqual(['Struggles with pointer arithmetic']);
  });
  it('drops anything it cannot trust: bad JSON, unknown types, past or absurd times', () => {
    const raw = ['ok', '@@ACTION {not json', '@@ACTION {"type":"delete.everything"}', `@@ACTION {"type":"calendar.add","title":"Past","startsAt":"2000-01-01T10:00:00Z","endsAt":"2000-01-01T11:00:00Z"}`, `@@ACTION {"type":"calendar.add","title":"Marathon","startsAt":"${soon(2)}","endsAt":"${soon(40)}"}`, '@@ACTION {"type":"path.rebuild"}'].join('\n');
    const p = splitDirectives(raw);
    expect(p.actions).toEqual([{ type: 'path.rebuild' }]);
    expect(p.text).toBe('ok');
  });
  it('proposes at most two actions, never twice the same, and keeps notes short', () => {
    const p = splitDirectives('x\n@@ACTION {"type":"plan.sessions"}\n@@ACTION {"type":"plan.sessions"}\n@@ACTION {"type":"path.rebuild"}\n@@ACTION {"type":"review.open"}\n@@NOTE ' + 'a'.repeat(300) + '\n@@NOTE short');
    expect(p.actions.map((a) => a.type)).toEqual(['plan.sessions', 'path.rebuild']);
    expect(p.notes).toHaveLength(1);
    expect(p.notes[0]).toHaveLength(160);
  });
  it('leaves an ordinary answer untouched', () => {
    expect(splitDirectives('Just an answer.\nWith two lines.')).toEqual({ text: 'Just an answer.\nWith two lines.', actions: [], notes: [] });
  });
});

describe('matching a school deadline to a stage', () => {
  it('finds a stage by its name, a part of it, or the word before the colon', () => {
    expect(eventMatchesStage('Zappy: final delivery', 'Zappy')).toBe(true);
    expect(eventMatchesStage('my_printf delivery', 'my_ls and my_printf')).toBe(true);
    expect(eventMatchesStage('Minishell defense', 'Minishell')).toBe(true);
    expect(eventMatchesStage('Piscine C exam', 'Piscine: C and Unix pool')).toBe(true);
    expect(eventMatchesStage('MINISHELL', 'minishell')).toBe(true);
  });
  it('does not confuse unrelated names', () => {
    expect(eventMatchesStage('Campus open day', 'Minishell')).toBe(false);
    expect(eventMatchesStage('Zappy delivery', 'Arcade and Nanotekspice')).toBe(false);
  });
  it('ignores parts too short to mean anything', () => {
    expect(titleKeys('C and Go')).toEqual(['c and go']);
    expect(eventMatchesStage('Go to the party', 'C and Go')).toBe(false);
  });
});

# TechTalk for schools

A school that joins TechTalk gets three things, all through one API key:

1. **Its curriculum on the platform.** Students who pick the school get a learning path with a dedicated stage for what they study, and resources about those topics rank first.
2. **Its calendar in its students' calendars.** Exams, deadlines and campus events you push appear, read-only, in the calendar of the right students.
3. **Anonymous statistics about its learners**, only from those who agreed to share, and only in groups of at least 5.

It also unlocks the **Campus** for its students: revision sessions they organise, a library of past exams (you can add official ones), and an opt-in directory to meet other students.

Epitech is the first school on the platform.

## Getting a key

An administrator opens **Admin → Schools**, adds the school (or finds it in the list) and clicks **Generate API key**. The key looks like `ttk_...`. It is shown **once**: copy it then. If it is lost or leaked, **Replace API key** retires the old one immediately.

Keep the key on a server. Never put it in a web page or a mobile app.

## Using the API

Base URL: your API address plus `/api/partner` (for example `https://tech-talk-iqmx.onrender.com/api/partner`). Send the key in a header:

```
X-API-Key: ttk_...
```

(`Authorization: Bearer ttk_...` also works.) Bodies are JSON. Limit: 120 requests a minute per key.

### Check the key

```bash
curl -H "X-API-Key: $KEY" $BASE/api/partner/me
```

### Keep the curriculum up to date

One list of topics per year, year 1 first. Topics are lower-cased and de-duplicated; up to 12 per year, 8 years.

```bash
curl -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/json" $BASE/api/partner/curriculum -d '{
  "years": [
    ["c", "unix", "shell", "git", "algorithms"],
    ["c++", "data structures", "networking", "object-oriented"],
    ["web", "databases", "docker", "design patterns"]
  ]
}'
```

Students see these topics as suggestions when they add their school and choose their year; they can edit them.

### Send the full programme (years, projects, skills)

Besides the simple topic list, a school can send its **programme**: year by year, the modules and projects students go through. TechTalk uses it three ways: the **Campus → Programme** tab shows it (with the skills each year builds), a student can **follow a year as a learning path** (one stage per project, resources chosen for what the project teaches), and the topics feed the suggestions.

```bash
curl -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/json" $BASE/api/partner/curriculum -d '{
  "programme": {
    "status": "confirmed",
    "years": [
      { "year": 1, "title": "Year 1: C, Unix and the foundations",
        "summary": "An intensive start in C and the shell.",
        "projects": [
          { "name": "Minishell", "kind": "project", "hours": 40,
            "summary": "Write a small Unix shell.",
            "topics": ["c", "unix", "processes", "shell", "pipes"] }
        ] }
    ]
  }
}'
```

- `topics` matter most: **the first two are the project's main topics**, and every suggested resource must be about at least one of them; the others refine the choice. Use plain, lower-case subject words (`c`, `unix`, `networking`, `game development`).
- `kind` is `piscine`, `project`, `module` or `internship`. `hours` (1 to 600) is roughly how long the work takes; it sizes the help around the project.
- `status` is `draft` or `confirmed`. Until you send `"confirmed"`, students see a notice that the programme is a starting draft. **Epitech's programme on TechTalk is currently a draft written from public sources: please check it and send the confirmed version.**
- If you send only `programme`, the simple per-year topic list is derived from it. If you send only `years` (topics), nothing about projects changes.

### Push exams, deadlines and events

Up to 200 per request. `externalId` is **your** identifier: sending the same one again updates the event instead of duplicating it. `year` (1 to 8) limits the event to students of that year; leave it out for everyone. Times are ISO 8601 (use UTC or include an offset).

```bash
curl -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/json" $BASE/api/partner/events -d '{
  "events": [
    { "externalId": "piscine-c-exam-2026", "title": "Piscine C: final exam", "kind": "school",
      "startsAt": "2026-12-08T08:00:00Z", "endsAt": "2026-12-08T12:00:00Z", "year": 1,
      "notes": "Room A2, bring your student card." },
    { "externalId": "open-day-2026", "title": "Campus open day", "kind": "event",
      "startsAt": "2026-12-12T09:00:00Z", "endsAt": "2026-12-12T17:00:00Z" }
  ]
}'
```

`kind` is `school`, `deadline`, `event` or `study`. Other calls: `GET /events` (upcoming ones you pushed) and `DELETE /events/{externalId}`.

### Add official past exams

Links only (a drive, a repository, your intranet if it is public). Pushing the same link again updates it. Official items are marked "From the school", listed first, and never hidden by reports.

```bash
curl -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/json" $BASE/api/partner/resources -d '{
  "resources": [
    { "title": "Piscine C exam 2025", "kind": "exam", "subject": "C programming", "year": 2025, "studyYear": 1,
      "url": "https://example.org/exams/c-2025.pdf", "description": "With the marking scheme." }
  ]
}'
```

`kind` is `exam`, `correction`, `td`, `notes` or `cheatsheet`.

### Read the statistics

```bash
curl -H "X-API-Key: $KEY" $BASE/api/partner/stats
```

Returns the number of learners who agreed to share, their average progress, a breakdown by year, goal and level, and the resources most often completed. **Privacy rules built into the endpoint:**

- Fewer than **5** sharing learners: the answer is only `{ "suppressed": true }`, with no numbers.
- Any breakdown group smaller than 5 is left out, so no one can be singled out.
- Names, emails and individual progress are never returned.

## What students control

Both choices start **off** and can be changed at any time in Settings → *Your learning data*:

| Choice | Effect |
| --- | --- |
| Share my progress with my school | Counts towards your statistics (above). Turning it off removes them from the next request. |
| Help improve recommendations | Their finished or dropped resources count, in totals of at least 5 learners, towards better suggestions for everyone on the platform. |

The campus directory is a separate opt-in (off by default, visible only to students of the same school, never showing emails). Deleting an account removes everything.

## Errors

`401` missing, wrong or disabled key · `400` invalid body (the message names the problem, e.g. `events[2]: endsAt must be after startsAt.`) · `409` limits reached · `429` too many requests.

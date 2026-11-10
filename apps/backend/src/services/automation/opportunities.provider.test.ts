import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ config: { github: { token: 't', topics: [], minStars: 100, maxPerTopic: 2 } } }));
vi.mock('../../db/db.js', () => ({ db: {} }));

import { teaser, stripHtml, jobToRow, issueToRow } from './opportunities.provider.js';

describe('text helpers', () => {
  it('strips tags and entities', () => {
    expect(stripHtml('<p>Hello&nbsp;<b>world</b> &amp; co</p><script>x()</script>')).toBe('Hello world & co');
  });

  it('turns markdown into a short plain teaser', () => {
    const md = '## Bug\n\nSee [the docs](https://x.dev) and ```code block``` for **details**. ' + 'word '.repeat(80);
    const out = teaser(md, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out).not.toMatch(/[#*`\[\]]|https/);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('row mapping', () => {
  it('maps a remote job and credits its source', () => {
    const row = jobToRow({
      id: 1, url: 'https://remotive.com/remote-jobs/x-1', title: 'Backend Engineer', company_name: 'Acme',
      company_logo: 'https://logo', category: 'Software Development', tags: ['node'], candidate_required_location: 'Europe',
      salary: '$80k', description: '<p>Build <b>APIs</b>.</p>',
    });
    expect(row).toMatchObject({ source: 'Remotive', type: 'opportunity', image: 'https://logo', summary: 'Build APIs .' });
    expect(row.meta).toMatchObject({ kind: 'job', company: 'Acme', location: 'Europe', salary: '$80k' });
  });

  it('maps a good first issue to its repository', () => {
    const row = issueToRow(
      { html_url: 'https://github.com/o/r/issues/1', title: 'Fix typo', body: 'Typo in README', comments: 2,
        labels: [{ name: 'good first issue' }, { name: 'docs' }], repository_url: 'https://api.github.com/repos/o/r', created_at: '' },
      'https://avatar',
    );
    expect(row).toMatchObject({ source: 'GitHub', type: 'opportunity', image: 'https://avatar' });
    expect(row.meta).toEqual({ kind: 'issue', repo: 'o/r', labels: ['docs'], comments: 2 });
  });
});

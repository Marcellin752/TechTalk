import { describe, it, expect, vi } from 'vitest';
import { validateHandle, suggestHandle, publicView, sitemapXml, cleanQuery, RESERVED_HANDLES, type ProfileSources } from './public-profile.js';

describe('handles', () => {
  it('accepts clean names and lowercases them', () => {
    expect(validateHandle('Ada-Lovelace_1')).toEqual({ ok: true, handle: 'ada-lovelace_1' });
  });
  it('rejects bad shapes and reserved words', () => {
    for (const bad of ['ab', '-ada', 'ada-', 'a b c', 'ada!', 'x'.repeat(31), '', null]) expect(validateHandle(bad as any).ok).toBe(false);
    for (const word of ['admin', 'api', 'people', 'u', 'kairos']) expect(RESERVED_HANDLES.has(word)).toBe(true);
    expect(validateHandle('admin')).toMatchObject({ ok: false });
  });
  it('suggests a handle from a login or a name, or nothing', () => {
    expect(suggestHandle('Ada Lovelace')).toBe('ada-lovelace');
    expect(suggestHandle('Aris HAZOUME')).toBe('aris-hazoume');
    expect(suggestHandle('Émile Zola')).toBe('emile-zola');
    expect(suggestHandle('aris-etek1-git')).toBe('aris-etek1-git');
    expect(suggestHandle('ab')).toBe('');
    expect(suggestHandle('admin')).toBe('');
  });
});

describe('publicView: what a stranger sees', () => {
  const gh = { login: 'ada', name: 'Ada', bio: 'Maths and machines', avatarUrl: 'https://a/v.png', htmlUrl: 'https://github.com/ada', publicRepos: 9, followers: 3, totalStars: 40, languages: [{ name: 'Rust', share: 0.6 }], topRepos: [{ name: 'engine' }] };
  const path = { title: 'Back-end path', goal: 'backend', level: 'basics', hoursPerWeek: 5, percent: 30, weeksTotal: 12, stages: [{ index: 0 }] };
  const base = (over: Partial<ProfileSources['settings']> = {}, extra: Partial<ProfileSources> = {}): ProfileSources => ({
    handle: 'ada', name: 'Ada L', picture: null, github: gh, path, updatedAt: new Date('2026-11-01'),
    settings: { isPublic: true, showProjects: true, showInterests: true, pathPublic: false, interests: ['Backend'], ...over }, ...extra,
  });

  it('hides the learning path unless it was made public on its own', () => {
    expect(publicView(base({ pathPublic: false })).path).toBeNull();
    expect(publicView(base({ pathPublic: false })).pathIsPrivate).toBe(true);
    const open = publicView(base({ pathPublic: true }));
    expect(open.path).toMatchObject({ title: 'Back-end path', percent: 30 });
    expect(open.pathIsPrivate).toBe(false);
  });

  it('respects the projects and interests switches', () => {
    const v = publicView(base({ showProjects: false, showInterests: false }));
    expect(v.projects).toBeNull();
    expect(v.interests).toBeNull();
    const all = publicView(base());
    expect(all.projects).toEqual([{ name: 'engine' }]);
    expect(all.interests).toEqual(['Backend']);
  });

  it('never exposes an email or internal ids, and falls back to the GitHub avatar', () => {
    const v = publicView(base());
    expect(JSON.stringify(v)).not.toMatch(/email|userId|password/i);
    expect(v.picture).toBe('https://a/v.png');
    expect(publicView(base({}, { picture: 'https://p/me.png' })).picture).toBe('https://p/me.png');
  });

  it('works without GitHub', () => {
    const v = publicView(base({}, { github: null }));
    expect(v.github).toBeNull();
    expect(v.projects).toBeNull();
    expect(v.languages).toEqual([]);
  });
});

describe('directory and sitemap', () => {
  it('escapes SQL wildcards in the search text and caps its length', () => {
    expect(cleanQuery('50%_off')).toBe('50\\%\\_off');
    expect(cleanQuery('x'.repeat(200))).toHaveLength(60);
    expect(cleanQuery(undefined)).toBe('');
  });
  it('lists the site pages and every public profile, with escaped handles', () => {
    const xml = sitemapXml('https://t3chtalk.vercel.app/', [{ handle: 'ada', updatedAt: new Date('2026-11-02') }, { handle: 'a-b', updatedAt: new Date('2026-11-03') }]);
    expect(xml).toContain('<loc>https://t3chtalk.vercel.app/</loc>');
    expect(xml).toContain('<loc>https://t3chtalk.vercel.app/people</loc>');
    expect(xml).toContain('<loc>https://t3chtalk.vercel.app/u/ada</loc>');
    expect(xml).toContain('<lastmod>2026-11-03</lastmod>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});

import { cleanDetail } from './public-profile.js';

describe('profile details (edit profile)', () => {
  it('trims, collapses spaces and treats empty as "remove"', () => {
    expect(cleanDetail('bio', '  Hello   world \n')).toEqual({ ok: true, value: 'Hello world' });
    expect(cleanDetail('location', '   ')).toEqual({ ok: true, value: null });
    expect(cleanDetail('bio', null)).toEqual({ ok: true, value: null });
  });
  it('enforces the length limits', () => {
    expect(cleanDetail('bio', 'x'.repeat(281)).ok).toBe(false);
    expect(cleanDetail('bio', 'x'.repeat(280)).ok).toBe(true);
    expect(cleanDetail('location', 'y'.repeat(81)).ok).toBe(false);
  });
  it('accepts web links, adds https to a bare domain, and refuses other schemes', () => {
    expect(cleanDetail('website', 'ada.dev')).toEqual({ ok: true, value: 'https://ada.dev/' });
    expect(cleanDetail('website', 'http://ada.dev/x')).toEqual({ ok: true, value: 'http://ada.dev/x' });
    expect(cleanDetail('website', 'javascript:alert(1)').ok).toBe(false);
    expect(cleanDetail('avatarUrl', 'data:image/png;base64,AAAA').ok).toBe(false);
    expect(cleanDetail('avatarUrl', 'not a link').ok).toBe(false);
    expect(cleanDetail('avatarUrl', 'https://cdn.x/me.png')).toEqual({ ok: true, value: 'https://cdn.x/me.png' });
  });
  it('lets the profile\'s own bio and photo win over GitHub, and exposes location and website', () => {
    const gh = { login: 'a', name: null, bio: 'GitHub bio', avatarUrl: 'https://gh/a.png', htmlUrl: null, publicRepos: 1, followers: 0, totalStars: 0, languages: [], topRepos: [] };
    const v = publicView({ handle: 'a', name: 'A', picture: 'https://google/a.png', github: gh, path: null, updatedAt: new Date(), settings: { isPublic: true, showProjects: true, showInterests: true, pathPublic: false, interests: [], bio: 'My bio', location: 'Paris', website: 'https://a.dev/', avatarUrl: 'https://mine/me.png' } });
    expect(v).toMatchObject({ bio: 'My bio', location: 'Paris', website: 'https://a.dev/', picture: 'https://mine/me.png' });
    const fallback = publicView({ handle: 'a', name: 'A', picture: null, github: gh, path: null, updatedAt: new Date(), settings: { isPublic: true, showProjects: true, showInterests: true, pathPublic: false, interests: [] } });
    expect(fallback).toMatchObject({ bio: 'GitHub bio', picture: 'https://gh/a.png', location: null, website: null });
  });
});

/* The rules of what a stranger may see. Kept pure so they can be tested without a
   database: the controller loads rows, this decides what leaves the server. */

export const RESERVED_HANDLES = new Set([
  'admin', 'api', 'login', 'logout', 'signup', 'settings', 'people', 'u', 'kairos', 'learn', 'practice', 'path',
  'profile', 'about', 'saved', 'onboarding', 'watch', 'project', 'article', 'root', 'support', 'techtalk', 'help',
  'sitemap', 'robots', 'static', 'assets', 'me', 'null', 'undefined',
]);

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export function validateHandle(raw: unknown): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = String(raw ?? '').trim().toLowerCase();
  if (!HANDLE_RE.test(handle)) return { ok: false, error: 'Use 3 to 30 letters, numbers, "-" or "_", starting and ending with a letter or number.' };
  if (RESERVED_HANDLES.has(handle)) return { ok: false, error: 'This name is reserved. Pick another one.' };
  return { ok: true, handle };
}

/** A starting suggestion from a GitHub login or a display name. */
export function suggestHandle(source: string): string {
  const slug = source.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '');
  return slug.length >= 3 && !RESERVED_HANDLES.has(slug) ? slug : '';
}

export interface Settings {
  isPublic: boolean;
  showProjects: boolean;
  showInterests: boolean;
  pathPublic: boolean;
  interests: string[];
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
}

const LIMITS = { bio: 280, location: 80, website: 200, avatarUrl: 500 } as const;
export type DetailField = keyof typeof LIMITS;

/** Cleans one of the free-text profile fields. Empty means "remove"; links must be http(s). */
export function cleanDetail(field: DetailField, raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: `${field} must be text.` };
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value === '') return { ok: true, value: null };
  if (value.length > LIMITS[field]) return { ok: false, error: `${field === 'avatarUrl' ? 'Photo link' : field} is too long (max ${LIMITS[field]} characters).` };
  if (field === 'website' || field === 'avatarUrl') {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    } catch {
      return { ok: false, error: `${field === 'avatarUrl' ? 'Photo link' : 'Website'} is not a valid link.` };
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Only http(s) links are allowed.' };
    return { ok: true, value: url.toString() };
  }
  return { ok: true, value };
}

export interface ProfileSources {
  handle: string;
  name: string;
  picture: string | null;
  github: { login: string; name: string | null; bio: string | null; avatarUrl: string | null; htmlUrl: string | null; publicRepos: number; followers: number; totalStars: number; languages: Array<{ name: string; share: number }>; topRepos: unknown[] } | null;
  settings: Settings;
  path: { title: string; goal: string; level: string; hoursPerWeek: number; percent: number; weeksTotal: number; stages: unknown[] } | null;
  updatedAt: Date;
}

/** The public face: only what the owner opted into. The learning path needs its own switch. */
export function publicView(src: ProfileSources) {
  const { settings: s, github: gh } = src;
  return {
    handle: src.handle,
    name: src.name,
    picture: s.avatarUrl ?? src.picture ?? gh?.avatarUrl ?? null,
    bio: s.bio ?? gh?.bio ?? null,
    location: s.location ?? null,
    website: s.website ?? null,
    github: gh ? { login: gh.login, url: gh.htmlUrl, publicRepos: gh.publicRepos, followers: gh.followers, totalStars: gh.totalStars } : null,
    languages: gh ? gh.languages.slice(0, 6) : [],
    projects: s.showProjects && gh ? gh.topRepos : null,
    interests: s.showInterests ? s.interests : null,
    path: s.pathPublic ? src.path : null,
    pathIsPrivate: !s.pathPublic,
    updatedAt: src.updatedAt,
  };
}

/** Parses the query of the directory: free text over handle, name, interests. */
export function cleanQuery(q: unknown): string {
  return String(q ?? '').trim().slice(0, 60).replace(/[%_\\]/g, (m) => `\\${m}`);
}

export function sitemapXml(siteUrl: string, handles: Array<{ handle: string; updatedAt: Date }>): string {
  const base = siteUrl.replace(/\/$/, '');
  const url = (loc: string, lastmod?: Date, changefreq = 'weekly') =>
    `  <url><loc>${base}${loc}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>${changefreq}</changefreq></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url('/', undefined, 'daily'), url('/people', undefined, 'daily'), ...handles.map((h) => url(`/u/${encodeURIComponent(h.handle)}`, h.updatedAt))].join('\n')}
</urlset>
`;
}

import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Access tokens last 15 minutes; renew a few minutes before they run out.
const REFRESH_BEFORE_EXPIRY_MS = 3 * 60 * 1000;

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; picture: string | null };
}

export interface GithubLanguage { name: string; share: number }
export interface GithubRepoSummary {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
  pushedAt: string;
}
export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
  publicRepos: number;
  followers: number;
  totalStars: number;
  languages: GithubLanguage[];
  topRepos: GithubRepoSummary[];
  syncedAt: string;
}
export interface GithubProfileState {
  linked: boolean;
  profile: GithubProfile | null;
  error?: string | null;
  throttled?: boolean;
}

export type LearningGoal = 'frontend' | 'backend' | 'fullstack' | 'data-ai' | 'devops' | 'security' | 'systems';
export type LearningLevel = 'beginner' | 'basics' | 'intermediate' | 'advanced';
export type LearningStyle = 'videos' | 'reading' | 'practice' | 'mixed';

export interface LearningProfile {
  goal: LearningGoal;
  level: LearningLevel;
  languages: string[];
  hoursPerWeek: number;
  style: LearningStyle;
  /** Optional: what the learner studies at school. */
  school?: string | null;
  schoolId?: string | null;
  schoolYear?: number | null;
  schoolTopics?: string[];
  /** Consent switches, off until the learner turns them on. */
  shareWithSchool?: boolean;
  shareForRecommendations?: boolean;
}

export interface SchoolPreset { id: string; name: string; years: string[][]; /** True when the school has joined TechTalk. */ partner?: boolean }

export type CalendarKind = 'study' | 'school' | 'deadline' | 'event';
export interface CalendarEvent {
  id: string;
  title: string;
  kind: CalendarKind;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  done: boolean;
  stepId: string | null;
  contentId: string | null;
  contentUrl: string | null;
  contentType: string | null;
  /** "school" events come from the learner's school and cannot be edited. */
  source?: 'personal' | 'school';
  schoolName?: string | null;
}
export interface CalendarInput {
  title: string;
  kind: CalendarKind;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  done?: boolean;
}

export interface AdminStats {
  users: { total: number; lastWeek: number; admins: number; publicProfiles: number; activeSessions: number };
  activity: { comments: number; kairosMessages24h: number; kairosMessages7d: number; activePaths: number };
  content: { total: number; byType: { type: string; n: number }[]; bySource: { source: string; n: number; latest: string | null }[] };
  sync: { running: boolean; startedAt: string | null; finishedAt: string | null; lastError: string | null };
  audit: { id: string; adminEmail: string; action: string; target: string | null; createdAt: string }[];
}
export interface AdminUser {
  id: string; name: string; email: string; role: 'user' | 'admin'; createdAt: string;
  hasPassword: boolean; google: boolean; github: boolean; githubLogin: string | null; isPublic: boolean; handle: string | null;
}
export interface AdminComment {
  id: string; body: string; createdAt: string;
  author: { id: string; name: string; email: string }; content: { id: string; title: string };
}
export interface CampusMe { discoverable: boolean; headline: string | null; lookingFor: 'study-buddy' | 'mentor' | 'mentee' | 'team' | null; contact: string | null }
export interface CampusOverview { school: { name: string; year: number | null }; counts: { resources: number; sessions: number; people: number }; me: CampusMe }
export type ResourceKind = 'exam' | 'correction' | 'td' | 'notes' | 'cheatsheet';
export interface CampusResource {
  id: string; title: string; kind: ResourceKind; subject: string; year: number | null; studyYear: number | null; url: string;
  description: string | null; official: boolean; votes: number; createdAt: string; mine: boolean; voted: boolean;
}
export interface CampusSession {
  id: string; title: string; subject: string; description: string | null; startsAt: string; endsAt: string; place: string | null; onlineUrl: string | null;
  capacity: number; hostId: string; hostName: string; hostPicture: string | null; members: number; joined: boolean; mine: boolean; full: boolean;
}
export interface CampusPerson { id: string; name: string; picture: string | null; year: number | null; topics: string[]; headline: string | null; lookingFor: CampusMe['lookingFor']; contact: string | null; handle: string | null; shared: string[] }
export interface CampusProgramme {
  school: { name: string }; myYear: number | null; status: 'draft' | 'confirmed' | null;
  years: Array<{
    year: number; title: string; summary: string | null; skills: string[]; hours: number; path: { id: string; percent: number } | null;
    projects: Array<{ name: string; summary: string | null; topics: string[]; kind: string; hours: number | null; progress: { done: number; total: number } | null }>;
  }>;
}
export interface AdminCampusResource { id: string; title: string; subject: string; url: string; status: 'approved' | 'hidden'; reports: number; votes: number; official: boolean; school: string; author: string | null; createdAt: string }
export interface SchoolProgramme { status?: 'draft' | 'confirmed'; years: Array<{ year: number; title: string; summary?: string; projects: Array<{ name: string; summary?: string; topics: string[]; kind?: string; hours?: number }> }> }
export interface AdminSchool {
  id: string; slug: string; name: string; contactEmail: string | null; active: boolean; curriculum: { years: string[][]; programme?: SchoolProgramme };
  keyPrefix: string | null; keyCreatedAt: string | null; lastUsedAt: string | null; createdAt: string; learners: number; sharing: number;
}
export interface AdminContent { id: string; title: string; url: string; source: string; type: string; createdAt: string }

export type StepStatus = 'todo' | 'doing' | 'done';
export interface PathStep {
  id: string;
  position: number;
  stage: number;
  kind: 'orient' | 'learn' | 'practice' | 'project' | 'read';
  minutes: number;
  status: StepStatus;
  completedAt: string | null;
  content: { id: string; type: string; title: string; url: string; source: string; summary: string | null; image: string | null; meta: Record<string, any> | null };
}
export interface PathStageView {
  /** For school paths: what the project teaches, and what sort of stage it is. */
  topics?: string[];
  kind?: string;
  index: number;
  title: string;
  objective: string;
  minutes: number;
  steps: PathStep[];
  done: number;
  total: number;
  complete: boolean;
}
export type PathKind = 'personal' | 'school' | 'custom';
export interface PathSummary {
  id: string; kind: PathKind; title: string; active: boolean; goal: string; level: string; schoolYear: number | null; createdAt: string;
  progress: { doneSteps: number; totalSteps: number; percent: number };
}
export interface LearningPath {
  kind?: PathKind;
  /** The main path is the one the home page and Kairos follow. */
  active?: boolean;
  schoolYear?: number | null;
  /** School paths: the school has not confirmed its programme yet. */
  programmeDraft?: boolean;
  id: string;
  title: string;
  goal: LearningGoal;
  level: LearningLevel;
  hoursPerWeek: number;
  stages: PathStageView[];
  currentStage: number | null;
  next: PathStep | null;
  progress: { doneSteps: number; totalSteps: number; percent: number; minutesDone: number; minutesTotal: number; weeksLeft: number; weeksTotal: number };
}

export interface KairosSource { n: number; id: string; type: string; title: string; url: string; source: string }
export interface KairosMessage { id: string; role: 'user' | 'assistant'; content: string; sources?: KairosSource[] | null; feedback?: 1 | -1 | null; createdAt: string }
export interface KairosConversation { id: string; title: string; updatedAt: string }
export interface ActivityItem {
  kind: 'read' | 'step';
  at: string;
  content: { id: string; type: string; title: string; source: string; url: string; image: string | null };
}

export interface ProfileSettings {
  handle: string | null;
  isPublic: boolean;
  showProjects: boolean;
  showInterests: boolean;
  pathPublic: boolean;
  interests: string[];
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
}
export interface PublicPathStep { kind: PathStep['kind']; minutes: number; status: StepStatus; content: { id: string; type: string; title: string; url: string; source: string } }
export interface PublicProfile {
  handle: string;
  name: string;
  picture: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  github: { login: string; url: string | null; publicRepos: number; followers: number; totalStars: number } | null;
  languages: GithubLanguage[];
  projects: GithubRepoSummary[] | null;
  interests: string[] | null;
  path: null | {
    title: string; goal: LearningGoal; level: LearningLevel; hoursPerWeek: number; percent: number; weeksTotal: number;
    stages: Array<{ index: number; title: string; objective: string; done: number; total: number; steps: PublicPathStep[] }>;
  };
  pathIsPrivate: boolean;
  updatedAt: string;
}
export interface PublicProfileCard {
  handle: string;
  name: string;
  picture: string | null;
  languages: string[];
  interests: string[];
  goal: LearningGoal | null;
  percent: number | null;
}

export interface Identities {
  email: string;
  hasPassword: boolean;
  google: boolean;
  github: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  picture?: string | null;
}

export interface Content {
  id: string;
  title: string;
  url: string;
  source: string;
  type: 'article' | 'video' | 'social_post';
  summary: string | null;
  body?: string | null;
  categories?: string[] | null;
  embedCode: string | null;
  createdAt: string;
}

export const api = {
  getToken(): string | null {
    return localStorage.getItem('teachtalk_token');
  },

  setToken(token: string): void {
    localStorage.setItem('teachtalk_token', token);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('teachtalk_refresh');
  },

  setRefreshToken(token: string): void {
    localStorage.setItem('teachtalk_refresh', token);
  },

  /** Stores what a sign-in or a refresh handed back. */
  setSession(data: { token: string; refreshToken?: string; user?: User }): void {
    this.setToken(data.token);
    if (data.refreshToken) this.setRefreshToken(data.refreshToken);
    if (data.user) this.setUser(data.user);
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('teachtalk_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: User): void {
    localStorage.setItem('teachtalk_user', JSON.stringify(user));
  },

  /** Forgets the session here, and tells the server to retire the refresh token. */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        keepalive: true,
      }).catch(() => undefined);
    }
    localStorage.removeItem('teachtalk_token');
    localStorage.removeItem('teachtalk_refresh');
    localStorage.removeItem('teachtalk_user');
  },

  handleSessionExpired(): void {
    this.logout();
    toast.error("Your session has expired. Please sign in again.");
    setTimeout(() => window.location.reload(), 1500);
  },

  _refreshing: null as Promise<boolean> | null,

  decodeToken(token: string): Record<string, any> | null {
    try {
      const base64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
      if (!base64) return null;
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  },

  async tryRefresh(): Promise<boolean> {
    if (this._refreshing) return this._refreshing;
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    this._refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await response.json();
        if (!response.ok) {
          // Two tabs refreshing at once: the loser finds the winner's new token in storage.
          return this.getRefreshToken() !== refreshToken;
        }
        // Another tab may have rotated the token while this request was in flight.
        this.setSession(data);
        return true;
      } catch {
        return false;
      } finally {
        this._refreshing = null;
      }
    })();
    return this._refreshing;
  },

  scheduleTokenRefresh(): void {
    const token = this.getToken();
    if (!token) return;
    const payload = this.decodeToken(token);
    if (!payload || typeof payload.exp !== "number") return;
    const remainingMs = payload.exp * 1000 - Date.now();
    if (remainingMs <= 0) {
      this.tryRefresh();
      return;
    }
    const delay = Math.max(0, remainingMs - REFRESH_BEFORE_EXPIRY_MS);
    window.setTimeout(() => {
      this.tryRefresh().then((success) => {
        if (success) this.scheduleTokenRefresh();
      });
    }, delay);
  },

  async fetchWithAuth(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (response.status === 401 && retry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.fetchWithAuth(path, options, false);
      }
      this.handleSessionExpired();
    }
    return response;
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      this.setSession(data);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async googleLogin(credential: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Google Sign-In failed' };
      }
      this.setSession(data);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  /** §49 OAuth: the browser is handed to the backend, which redirects to GitHub. */
  githubStartUrl(): string {
    return `${API_URL}/auth/github`;
  },

  /** The callback returns the JWT in the URL fragment; adopt it, then load /me. */
  async adoptGithubToken(token: string, refreshToken?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    this.setSession({ token, refreshToken });
    const me = await this.getMe();
    if (!me.success) {
      this.logout();
      return { success: false, error: me.error || 'GitHub sign-in failed' };
    }
    return { success: true, user: me.user };
  },

  async getComments(contentId: string, offset = 0): Promise<{ comments: CommentItem[]; total: number }> {
    const res = await this.fetchWithAuth(`/content/${contentId}/comments?limit=30&offset=${offset}`);
    if (!res.ok) throw new Error('comments_unavailable');
    return res.json();
  },

  async addComment(contentId: string, body: string): Promise<{ success: boolean; comment?: CommentItem; error?: string }> {
    try {
      const res = await this.fetchWithAuth(`/content/${contentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not post the comment' };
      return { success: true, comment: data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const res = await this.fetchWithAuth(`/content/comments/${commentId}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** The developer profile imported from the linked GitHub account. */
  async getGithubProfile(): Promise<GithubProfileState> {
    const res = await this.fetchWithAuth('/profile/github');
    if (!res.ok) throw new Error('profile_unavailable');
    return res.json();
  },

  async syncGithubProfile(): Promise<{ success: boolean; state?: GithubProfileState; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/profile/github/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not refresh from GitHub' };
      return { success: true, state: data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  /** Which sign-in methods are attached to the signed-in account. */
  async getIdentities(): Promise<{ success: boolean; identities?: Identities; error?: string }> {
    return this.identityCall('/auth/identities');
  },

  async linkGoogle(credential: string) {
    return this.identityCall('/auth/link/google', { method: 'POST', body: JSON.stringify({ credential }) });
  },

  /** Returns the GitHub consent URL; the browser must navigate to it. */
  async startGithubLink(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/auth/link/github', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not start GitHub linking' };
      return { success: true, url: data.url };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async unlinkProvider(provider: 'google' | 'github') {
    return this.identityCall(`/auth/link/${provider}`, { method: 'DELETE' });
  },

  async setPassword(newPassword: string, currentPassword?: string) {
    return this.identityCall('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword, ...(currentPassword ? { currentPassword } : {}) }),
    });
  },

  async identityCall(path: string, init: RequestInit = {}): Promise<{ success: boolean; identities?: Identities; error?: string }> {
    try {
      const res = await this.fetchWithAuth(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Request failed' };
      return { success: true, identities: data as Identities };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async updateProfile(name: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update profile' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getMe(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/me');
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch profile' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getContents(limit?: number, offset?: number, search?: string, type?: string, categories?: string[], rank?: { sort: 'foryou' | 'wildcard'; interests?: string[] }): Promise<Content[]> {
    const url = new URL(`${API_URL}/content`);
    if (limit !== undefined) url.searchParams.append('limit', limit.toString());
    if (offset !== undefined) url.searchParams.append('offset', offset.toString());
    if (search) url.searchParams.append('search', search);
    if (type) url.searchParams.append('type', type);
    if (categories && categories.length > 0) url.searchParams.append('categories', categories.join(','));
    if (rank) {
      url.searchParams.append('sort', rank.sort);
      if (rank.interests?.length) url.searchParams.append('interests', rank.interests.join(','));
    }

    const response = await this.fetchWithAuth(`/content${url.search}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }
    return response.json();
  },

  async getLearningProfile(): Promise<LearningProfile | null> {
    const res = await this.fetchWithAuth('/learning/profile');
    if (!res.ok) throw new Error('learning_unavailable');
    return (await res.json()).profile;
  },

  /** Saves the preferences and builds the path from them. */
  async saveLearningProfile(profile: LearningProfile): Promise<{ success: boolean; path?: LearningPath; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/learning/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not build your path' };
      return { success: true, path: data.path };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getLearningPath(): Promise<LearningPath | null> {
    const res = await this.fetchWithAuth('/learning/path');
    if (!res.ok) throw new Error('learning_unavailable');
    return (await res.json()).path;
  },

  async regenerateLearningPath(): Promise<{ success: boolean; path?: LearningPath; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/learning/path/regenerate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not rebuild your path' };
      return { success: true, path: data.path };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  /** Small helper for the JSON endpoints below. */
  async call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
    try {
      const { json, ...rest } = init;
      const res = await this.fetchWithAuth(path, {
        ...rest,
        headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers || {}) },
        ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      });
      if (res.status === 204) return { success: true, status: 204 };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: (data as any).error || (data as any).message || 'Request failed', status: res.status };
      return { success: true, data: data as T, status: res.status };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // --- School
  async getSchools(): Promise<SchoolPreset[]> {
    const r = await this.call<{ schools: SchoolPreset[] }>('/learning/schools');
    return r.data?.schools ?? [];
  },
  async setConsent(input: { shareWithSchool?: boolean; shareForRecommendations?: boolean }) {
    const r = await this.call<{ profile: LearningProfile }>('/learning/consent', { method: 'PUT', json: input });
    return { success: r.success, profile: r.data?.profile, error: r.error };
  },
  async setSchool(input: { school: string; schoolYear: number | null; schoolTopics: string[]; shareWithSchool?: boolean; shareForRecommendations?: boolean }) {
    const r = await this.call<{ profile: LearningProfile; path: LearningPath | null; paths: PathSummary[] }>('/learning/school', { method: 'PUT', json: input });
    return { success: r.success, profile: r.data?.profile, path: r.data?.path ?? null, paths: r.data?.paths ?? [], error: r.error };
  },

  // --- Several paths
  async getPaths(): Promise<{ paths: PathSummary[]; max: number }> {
    const r = await this.call<{ paths: PathSummary[]; max: number }>('/learning/paths');
    if (!r.success) throw new Error(r.error || 'paths_unavailable');
    return r.data!;
  },
  async getPathById(id: string): Promise<LearningPath | null> {
    const r = await this.call<{ path: LearningPath }>(`/learning/paths/${id}`);
    return r.data?.path ?? null;
  },
  async createPath(input: { kind: PathKind; title?: string; goal?: string; level?: string; style?: string; hoursPerWeek?: number; languages?: string[]; schoolYear?: number }) {
    const r = await this.call<{ path: LearningPath }>('/learning/paths', { method: 'POST', json: input });
    return { success: r.success, path: r.data?.path, error: r.error };
  },
  async rebuildPath(id: string) {
    const r = await this.call<{ path: LearningPath }>(`/learning/paths/${id}/regenerate`, { method: 'POST' });
    return { success: r.success, path: r.data?.path, error: r.error };
  },
  async updatePath(id: string, input: { title?: string; active?: true }) {
    const r = await this.call<{ paths: PathSummary[] }>(`/learning/paths/${id}`, { method: 'PATCH', json: input });
    return { success: r.success, paths: r.data?.paths ?? [], error: r.error };
  },
  async deletePath(id: string) {
    const r = await this.call<{ paths: PathSummary[] }>(`/learning/paths/${id}`, { method: 'DELETE' });
    return { success: r.success, paths: r.data?.paths ?? [], error: r.error };
  },

  // --- Calendar
  async getCalendar(from: Date, to: Date): Promise<CalendarEvent[]> {
    const r = await this.call<{ events: CalendarEvent[] }>(`/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
    if (!r.success) throw new Error(r.error || 'calendar_unavailable');
    return r.data!.events;
  },
  async createEvent(input: CalendarInput) {
    const r = await this.call<{ event: CalendarEvent }>('/calendar', { method: 'POST', json: input });
    return { success: r.success, event: r.data?.event, error: r.error };
  },
  async updateEvent(id: string, input: Partial<CalendarInput>) {
    const r = await this.call<{ event: CalendarEvent }>(`/calendar/${id}`, { method: 'PATCH', json: input });
    return { success: r.success, event: r.data?.event, error: r.error };
  },
  async deleteEvent(id: string) {
    return this.call(`/calendar/${id}`, { method: 'DELETE' });
  },
  async planCalendar(input: { startHour: number; days: number[]; weeks: number; pathId?: string }) {
    const r = await this.call<{ planned: number }>('/calendar/plan', { method: 'POST', json: { ...input, tzOffset: new Date().getTimezoneOffset() } });
    return { success: r.success, planned: r.data?.planned ?? 0, error: r.error };
  },
  /** The calendar as an .ics file, to open in Google Calendar, Outlook or Apple Calendar. */
  async downloadCalendar(): Promise<boolean> {
    try {
      const res = await this.fetchWithAuth('/calendar/export.ics');
      if (!res.ok) return false;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'techtalk.ics';
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  },

  // --- Admin
  adminStats: () => api.call<AdminStats>('/admin/stats'),
  adminUsers: (q: string, offset: number) => api.call<{ users: AdminUser[]; total: number }>(`/admin/users?q=${encodeURIComponent(q)}&limit=20&offset=${offset}`),
  adminSetRole: (id: string, role: 'user' | 'admin') => api.call(`/admin/users/${id}/role`, { method: 'PATCH', json: { role } }),
  adminSignOutUser: (id: string) => api.call(`/admin/users/${id}/sign-out`, { method: 'POST' }),
  adminDeleteUser: (id: string) => api.call(`/admin/users/${id}`, { method: 'DELETE' }),
  adminComments: (q: string, offset: number) => api.call<{ comments: AdminComment[]; total: number }>(`/admin/comments?q=${encodeURIComponent(q)}&limit=20&offset=${offset}`),
  adminDeleteComment: (id: string) => api.call(`/admin/comments/${id}`, { method: 'DELETE' }),
  adminContents: (q: string, type: string, offset: number) => api.call<{ contents: AdminContent[]; total: number }>(`/admin/contents?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=20&offset=${offset}`),
  adminDeleteContent: (id: string) => api.call(`/admin/contents/${id}`, { method: 'DELETE' }),
  // --- Campus
  campusOverview: () => api.call<CampusOverview>('/campus'),
  campusProgramme: () => api.call<CampusProgramme>('/campus/programme'),
  campusResources: (f: { q?: string; subject?: string; kind?: string }, offset = 0) =>
    api.call<{ resources: CampusResource[]; total: number; subjects: string[] }>(`/campus/resources?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), ...(f.subject ? { subject: f.subject } : {}), ...(f.kind ? { kind: f.kind } : {}), limit: '20', offset: String(offset) })}`),
  campusAddResource: (input: Record<string, unknown>) => api.call<{ id: string }>('/campus/resources', { method: 'POST', json: input }),
  campusVote: (id: string) => api.call<{ voted: boolean; votes: number }>(`/campus/resources/${id}/vote`, { method: 'POST' }),
  campusReport: (id: string, reason?: string) => api.call(`/campus/resources/${id}/report`, { method: 'POST', json: { reason } }),
  campusDeleteResource: (id: string) => api.call(`/campus/resources/${id}`, { method: 'DELETE' }),
  campusSessions: () => api.call<{ sessions: CampusSession[] }>('/campus/sessions'),
  campusAddSession: (input: Record<string, unknown>) => api.call<{ id: string }>('/campus/sessions', { method: 'POST', json: input }),
  campusJoin: (id: string) => api.call(`/campus/sessions/${id}/join`, { method: 'POST' }),
  campusLeave: (id: string) => api.call(`/campus/sessions/${id}/join`, { method: 'DELETE' }),
  campusCancel: (id: string) => api.call(`/campus/sessions/${id}`, { method: 'DELETE' }),
  campusUpdateMe: (input: Partial<CampusMe>) => api.call<{ me: CampusMe }>('/campus/me', { method: 'PUT', json: input }),
  campusPeople: (f: { year?: string; lookingFor?: string; topic?: string }) =>
    api.call<{ people: CampusPerson[] }>(`/campus/people?${new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>)}`),
  adminCampusResources: (status: string, offset: number) => api.call<{ resources: AdminCampusResource[]; total: number }>(`/admin/campus/resources?status=${status}&limit=20&offset=${offset}`),
  adminCampusSetStatus: (id: string, status: 'approved' | 'hidden') => api.call(`/admin/campus/resources/${id}`, { method: 'PATCH', json: { status } }),
  adminCampusDelete: (id: string) => api.call(`/admin/campus/resources/${id}`, { method: 'DELETE' }),
  adminSchools: () => api.call<{ schools: AdminSchool[] }>('/admin/schools'),
  adminCreateSchool: (input: { name: string; contactEmail?: string | null }) => api.call<{ school: AdminSchool }>('/admin/schools', { method: 'POST', json: input }),
  adminUpdateSchool: (id: string, input: { name?: string; contactEmail?: string | null; active?: boolean; curriculum?: { years?: string[][]; programme?: unknown } }) => api.call<{ school: AdminSchool }>(`/admin/schools/${id}`, { method: 'PATCH', json: input }),
  adminSchoolKey: (id: string) => api.call<{ key: string; keyPrefix: string }>(`/admin/schools/${id}/key`, { method: 'POST' }),
  adminDeleteSchool: (id: string) => api.call(`/admin/schools/${id}`, { method: 'DELETE' }),
  adminSync: () => api.call('/admin/sync', { method: 'POST' }),
  adminSyncStatus: () => api.call<AdminStats['sync']>('/admin/sync'),

  async setStepStatus(stepId: string, status: StepStatus): Promise<{ success: boolean; path?: LearningPath; error?: string }> {
    try {
      const res = await this.fetchWithAuth(`/learning/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not save your progress' };
      return { success: true, path: data.path };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async kairosStatus(): Promise<{ available: boolean }> {
    try {
      const res = await this.fetchWithAuth('/kairos/status');
      return res.ok ? res.json() : { available: false };
    } catch {
      return { available: false };
    }
  },

  async kairosChat(message: string, conversationId?: string, lang?: string, page?: string): Promise<{ success: boolean; conversationId?: string; title?: string; message?: KairosMessage; suggestions?: string[]; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/kairos/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId, lang, page }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Kairos could not answer.' };
      return { success: true, conversationId: data.conversationId, title: data.title, message: data.message, suggestions: data.suggestions ?? [] };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async kairosFeedback(messageId: string, value: 1 | -1 | 0): Promise<boolean> {
    return (await this.call(`/kairos/messages/${messageId}/feedback`, { method: 'PATCH', json: { value } })).success;
  },

  async kairosConversations(): Promise<KairosConversation[]> {
    const res = await this.fetchWithAuth('/kairos/conversations');
    if (!res.ok) throw new Error('kairos_unavailable');
    return (await res.json()).conversations;
  },

  async kairosConversation(id: string): Promise<{ conversation: { id: string; title: string }; messages: KairosMessage[] }> {
    const res = await this.fetchWithAuth(`/kairos/conversations/${id}`);
    if (!res.ok) throw new Error('kairos_unavailable');
    return res.json();
  },

  async kairosRename(id: string, title: string): Promise<boolean> {
    return (await this.call(`/kairos/conversations/${id}`, { method: 'PATCH', json: { title } })).success;
  },

  async kairosDelete(id?: string): Promise<boolean> {
    try {
      const res = await this.fetchWithAuth(id ? `/kairos/conversations/${id}` : '/kairos/conversations', { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getHistory(): Promise<ActivityItem[]> {
    const res = await this.fetchWithAuth('/profile/history?limit=80');
    if (!res.ok) throw new Error('history_unavailable');
    return (await res.json()).items;
  },

  async clearHistory(): Promise<boolean> {
    try {
      const res = await this.fetchWithAuth('/profile/history', { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getProfileSettings(): Promise<{ settings: ProfileSettings; suggestedHandle: string }> {
    const res = await this.fetchWithAuth('/profile/settings');
    if (!res.ok) throw new Error('settings_unavailable');
    return res.json();
  },

  async saveProfileSettings(patch: Partial<ProfileSettings>): Promise<{ success: boolean; settings?: ProfileSettings; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/profile/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not save' };
      return { success: true, settings: data.settings };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async checkHandle(handle: string): Promise<{ available: boolean; reason: string | null }> {
    const res = await this.fetchWithAuth(`/profile/settings/handle?handle=${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error('check_failed');
    return res.json();
  },

  /** Public, no sign-in needed: what a stranger or a crawler may read. */
  async getPublicProfile(handle: string): Promise<PublicProfile | null> {
    const res = await fetch(`${API_URL}/public/profiles/${encodeURIComponent(handle)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('profile_unavailable');
    return res.json();
  },

  async listPublicProfiles(q: string, offset = 0): Promise<PublicProfileCard[]> {
    const url = new URL(`${API_URL}/public/profiles`);
    if (q.trim()) url.searchParams.set('q', q.trim());
    url.searchParams.set('offset', String(offset));
    const res = await fetch(url);
    if (!res.ok) throw new Error('profiles_unavailable');
    return (await res.json()).profiles;
  },

  /** Filtered lists for the Learn and Practice pages (type, platform, difficulty, kind, learn, search…). */
  async listContents(params: Record<string, string | number | undefined>): Promise<Content[]> {
    const url = new URL(`${API_URL}/content`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    const res = await this.fetchWithAuth(`/content${url.search}`);
    if (!res.ok) throw new Error(`Failed to fetch content: ${res.statusText}`);
    return res.json();
  },

  /** One item by id; lets a shared or reloaded link open its own page. */
  async getContent(contentId: string): Promise<Content> {
    const res = await this.fetchWithAuth(`/content/${contentId}`);
    if (res.status === 404 || res.status === 400) throw new Error('not_found');
    if (!res.ok) throw new Error('content_unavailable');
    return res.json();
  },

  async getBookmarks(): Promise<Content[]> {
    const response = await this.fetchWithAuth('/content/bookmarks');
    if (!response.ok) {
      throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
    }
    return response.json();
  },

  async addBookmark(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/content/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to add bookmark' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async deleteBookmark(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/content/bookmarks/${contentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete bookmark' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async markContentRead(contentId: string): Promise<void> {
    try {
      await this.fetchWithAuth('/content/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
    } catch (err) {
      console.error("Failed to sync read marker:", err);
    }
  },

  async syncReadingBatch(contentIds: string[]): Promise<void> {
    if (contentIds.length === 0) return;
    try {
      await this.fetchWithAuth('/content/read/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentIds }),
      });
    } catch (err) {
      console.error("Failed to sync reading batch:", err);
    }
  },

  async getServerReading(): Promise<{ readIds: string[]; readDates: string[] } | null> {
    try {
      const response = await this.fetchWithAuth('/content/read');
      if (!response.ok) return null;
      const data = await response.json();
      return { readIds: Array.isArray(data.readIds) ? data.readIds : [], readDates: Array.isArray(data.readDates) ? data.readDates : [] };
    } catch (err) {
      console.error("Failed to fetch server reading history:", err);
      return null;
    }
  }
};

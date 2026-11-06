import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const REFRESH_BEFORE_EXPIRY_MS = 10 * 60 * 1000;

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
}

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
  index: number;
  title: string;
  objective: string;
  minutes: number;
  steps: PathStep[];
  done: number;
  total: number;
  complete: boolean;
}
export interface LearningPath {
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
export interface KairosMessage { id: string; role: 'user' | 'assistant'; content: string; sources?: KairosSource[] | null; createdAt: string }
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

  logout(): void {
    localStorage.removeItem('teachtalk_token');
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
    const token = this.getToken();
    if (!token) return false;
    this._refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) return false;
        this.setToken(data.token);
        if (data.user) this.setUser(data.user);
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
      this.setToken(data.token);
      this.setUser(data.user);
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
      this.setToken(data.token);
      this.setUser(data.user);
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
  async adoptGithubToken(token: string): Promise<{ success: boolean; user?: User; error?: string }> {
    this.setToken(token);
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

  async kairosChat(message: string, conversationId?: string, lang?: string): Promise<{ success: boolean; conversationId?: string; title?: string; message?: KairosMessage; error?: string }> {
    try {
      const res = await this.fetchWithAuth('/kairos/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId, lang }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Kairos could not answer.' };
      return { success: true, conversationId: data.conversationId, title: data.title, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
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

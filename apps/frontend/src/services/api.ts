const API_URL = 'https://techtalk-xg62.onrender.com/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

export interface Content {
  id: string;
  title: string;
  url: string;
  source: string;
  type: 'article' | 'video';
  summary: string | null;
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

  async getContents(): Promise<Content[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_URL}/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
        window.location.reload();
      }
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }
    return response.json();
  }
};

import { getAppConfig } from './config';

const AUTH_STORAGE_KEY = 'secureauth_auth_session';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  deviceId?: string;
  syncEnabled: boolean;
  lastSyncedAt?: number;
  localRevision: number;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([AUTH_STORAGE_KEY], (res) => {
        resolve((res[AUTH_STORAGE_KEY] as AuthSession) || null);
      });
    });
  }
  const s = localStorage.getItem(AUTH_STORAGE_KEY);
  return s ? JSON.parse(s) : null;
}

export async function saveStoredSession(session: AuthSession | null): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      if (session === null) {
        chrome.storage.local.remove([AUTH_STORAGE_KEY], () => resolve());
      } else {
        chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session }, () => resolve());
      }
    });
  }
  if (session === null) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const config = await getAppConfig();
  const session = await getStoredSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  const url = `${config.apiBaseUrl.replace(/\/$/, '')}${endpoint}`;
  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && session?.refreshToken) {
    try {
      const refreshRes = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        session.accessToken = data.tokens.accessToken;
        session.refreshToken = data.tokens.refreshToken;
        await saveStoredSession(session);

        headers['Authorization'] = `Bearer ${session.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        await saveStoredSession(null);
      }
    } catch {
      // ignore network errors on refresh
    }
  }

  if (!response.ok) {
    let errMessage = `Request failed: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody.error) errMessage = errBody.error;
    } catch {}
    const error: any = new Error(errMessage);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

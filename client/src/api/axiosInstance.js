import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
if (!API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

const TOKEN_KEY = 'vault_access_token';

function getToken() {
  return window.__vaultAccessToken || localStorage.getItem(TOKEN_KEY) || null;
}

function setToken(token) {
  window.__vaultAccessToken = token;
  if (token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  } else {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
}

const api = axios.create({
  baseURL:     API_BASE_URL,
  withCredentials: true,
  headers:     { 'Content-Type': 'application/json' },
  timeout:     30000,  // 30s — handles Render free-tier cold starts
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 429 + auto-refresh on 401
let isRefreshing     = false;
let refreshQueue     = [];
let consecutive429   = 0;
const MAX_429        = 3;

api.interceptors.response.use(
  (res) => {
    consecutive429 = 0; // reset on any success
    return res;
  },
  async (error) => {
    const original = error.config;
    const status   = error.response?.status;

    // ── 429 Rate Limit: exponential backoff, max 3 retries ──────────────────
    if (status === 429) {
      consecutive429++;
      if (consecutive429 >= MAX_429) {
        consecutive429 = 0;
        console.error('[API] Rate limit hit too many times — stopping retries.');
        return Promise.reject(error);
      }
      const retryAfter = error.response?.data?.retryAfter || 5;
      const waitMs     = retryAfter * 1000 * consecutive429;
      console.warn(`[API] 429 received — waiting ${waitMs}ms before retry (attempt ${consecutive429}/${MAX_429})`);
      await new Promise(r => setTimeout(r, waitMs));
      return api(original);
    }

    // ── 401 Unauthorized: try token refresh exactly once ────────────────────
    if (
      status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh-token') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Another request is already refreshing — queue up and wait
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        let data;
        if (window.__vaultRefreshPromise) {
          console.log('[API] Interceptor awaiting active background refresh promise...');
          const result = await window.__vaultRefreshPromise;
          if (result.type !== 'ok') throw new Error(`Background refresh failed: ${result.type}`);
          data = result.data;
        } else {
          // Use native fetch to avoid interceptor re-entry
          const res = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
          });

          if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
          data = await res.json();
        }

        if (!data.accessToken) throw new Error('No token in response');

        const newToken = data.accessToken;
        setToken(newToken);

        // Update auth store
        try {
          const { useAuthStore } = await import('../store/authStore');
          useAuthStore.getState().setAccessToken(newToken);
          if (data.user) {
            useAuthStore.getState().setUser(data.user);
          }
        } catch {}

        // Resume all queued requests
        refreshQueue.forEach(p => p.resolve(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        refreshQueue.forEach(p => p.reject(err));
        refreshQueue = [];
        setToken(null);

        // Only redirect if NOT already on a public page — prevents infinite loop
        const pub = ['/login', '/register', '/'];
        if (!pub.some(p => window.location.pathname.startsWith(p))) {
          try {
            const { useAuthStore } = await import('../store/authStore');
            useAuthStore.getState().setUnauthenticated();
          } catch {}
          window.location.replace('/login');
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

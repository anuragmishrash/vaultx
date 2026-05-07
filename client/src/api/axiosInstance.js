import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
if (!API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

const TOKEN_KEY = 'vault_access_token';

function getToken() {
  // In-memory first (fastest), then localStorage fallback
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
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Don't retry on 429 — just propagate the error
    if (error.response?.status === 429) {
      return Promise.reject(error);
    }

    // Retry on any 401 except the refresh-token endpoint itself
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh-token') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        const newToken = data.accessToken;
        setToken(newToken);

        // Also update zustand store if available
        try {
          const { useAuthStore } = await import('../store/authStore');
          useAuthStore.getState().setAccessToken(newToken);
        } catch {}

        refreshQueue.forEach(p => p.resolve(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        refreshQueue.forEach(p => p.reject(err));
        refreshQueue = [];
        setToken(null);
        // Only redirect if not already on a public page
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
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

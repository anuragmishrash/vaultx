import { create } from 'zustand';

// ── Session persistence helpers ───────────────────────────────────────────────
const SESSION_KEY = 'vault_session';

function saveSession(user, token) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, savedAt: Date.now() }));
  } catch { /* localStorage might be disabled */ }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Expire after 7 days (matches refresh token lifetime)
    if (Date.now() - session.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function syncAxiosToken(token) {
  // Set/clear the axios default header — done async so store doesn't depend on axios at init time
  import('../api/axiosInstance').then(({ default: api }) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }).catch(() => {});
  // Also set the global for the request interceptor (belt-and-suspenders)
  if (token) {
    window.__vaultAccessToken = token;
    try { localStorage.setItem('vault_access_token', token); } catch {}
  } else {
    window.__vaultAccessToken = null;
    try { localStorage.removeItem('vault_access_token'); } catch {}
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Bootstrap from localStorage — used ONLY as initial state
const cachedSession = loadSession();

export const useAuthStore = create((set, get) => ({
  user:              cachedSession?.user  || null,
  accessToken:       cachedSession?.token || null,
  // If cached session exists → authenticated immediately (no loading screen needed)
  isAuthenticated:   !!cachedSession,
  // isLoading = false when cache exists (app shows immediately)
  // isLoading = true  when no cache (must wait for server response)
  isLoading:         !cachedSession,
  isLoggingOut:      false,
  serverUnreachable: false,
  sessionFromCache:  !!cachedSession,

  // ── Called after login OR server-verified session restore ──────────────────
  setAuthenticated: (user, token) => {
    saveSession(user, token);
    syncAxiosToken(token);
    set({
      user, accessToken: token,
      isAuthenticated:   true,
      isLoading:         false,
      isLoggingOut:      false,
      serverUnreachable: false,
      sessionFromCache:  false,
    });
  },

  // ── Called on genuine 401 — user must log in ───────────────────────────────
  setUnauthenticated: () => {
    clearSession();
    syncAxiosToken(null);
    set({
      user: null, accessToken: null,
      isAuthenticated: false, isLoading: false,
      serverUnreachable: false, sessionFromCache: false,
    });
  },

  // ── Called on network error / cold start / backend bug ────────────────────
  // Does NOT clear user/token — cached session stays active
  setServerUnreachable: () => {
    const { accessToken } = get();
    // Re-sync axios in case it was cleared
    if (accessToken) syncAxiosToken(accessToken);
    set({ serverUnreachable: true, isLoading: false });
  },

  // Alias kept for Login.jsx / Register.jsx compatibility
  setAuth: (user, token) => {
    saveSession(user, token);
    syncAxiosToken(token);
    set({
      user, accessToken: token,
      isAuthenticated:   true,
      isLoading:         false,
      isLoggingOut:      false,
      serverUnreachable: false,
      sessionFromCache:  false,
    });
  },

  setAccessToken: (token) => {
    const { user } = get();
    if (user && token) saveSession(user, token);
    syncAxiosToken(token);
    set({ accessToken: token });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  updateUser: (updates) => set(state => ({
    user: { ...state.user, ...updates },
  })),

  logout: async () => {
    if (get().isLoggingOut) return;
    set({ isLoggingOut: true });

    clearSession();
    syncAxiosToken(null);

    try {
      let BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      if (!BASE.endsWith('/api')) {
        BASE = BASE.replace(/\/$/, '') + '/api';
      }
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(get().accessToken ? { Authorization: `Bearer ${get().accessToken}` } : {}),
        },
      });
    } catch { /* ignore — logout locally regardless */ }

    set({
      user: null, accessToken: null,
      isAuthenticated: false, isLoading: false,
      isLoggingOut: false, serverUnreachable: false, sessionFromCache: false,
    });
    window.location.replace('/login');
  },
}));

// On startup — if we have a cached session, sync the axios header immediately
// (before any useEffect runs) so the first query has a token
if (cachedSession?.token) {
  syncAxiosToken(cachedSession.token);
}

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  addTransactionOpen: false,
  setAddTransactionOpen: (v) => set({ addTransactionOpen: v }),
}));

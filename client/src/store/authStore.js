import { create } from 'zustand';

// ── helpers ──────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'vault_access_token';

function saveToken(token) {
  window.__vaultAccessToken = token;
  if (token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  } else {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create((set, get) => ({
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isLoading:       true,     // true on first render — prevents flash of login page
  isLoggingOut:    false,

  // Called after successful login OR session restore from refresh-token
  // Atomically sets everything — unblocks all useAuthQuery hooks
  setAuth: (user, accessToken) => {
    saveToken(accessToken);
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading:       false,
      isLoggingOut:    false,
    });
  },

  // Called when auth fails or no session found (marks loading complete)
  setUnauthenticated: () => {
    saveToken(null);
    set({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      isLoading:       false,
    });
  },

  // Update just the token (e.g. after silent refresh mid-session via interceptor)
  setAccessToken: (token) => {
    saveToken(token);
    set({ accessToken: token });
  },

  // Restore user object (e.g. from refresh-token response in interceptor)
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

  logout: async () => {
    if (get().isLoggingOut) return;
    set({ isLoggingOut: true });

    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(get().accessToken ? { 'Authorization': `Bearer ${get().accessToken}` } : {}),
        },
      });
    } catch { /* ignore */ }

    saveToken(null);
    set({
      user: null, accessToken: null,
      isAuthenticated: false, isLoading: false, isLoggingOut: false,
    });

    window.location.replace('/login');
  },
}));

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  addTransactionOpen: false,
  setAddTransactionOpen: (v) => set({ addTransactionOpen: v }),
}));

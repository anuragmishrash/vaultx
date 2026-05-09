import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

function loadToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        saveToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      setAccessToken: (token) => {
        saveToken(token);
        set({ accessToken: token });
      },

      // Restore user object (e.g. from refresh-token response)
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      logout: () => {
        saveToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'vault-auth',
      // Persist user + auth flag + the token itself
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        // On rehydration, re-populate the in-memory global AND localStorage slot
        if (state?.accessToken) {
          saveToken(state.accessToken);
        } else {
          // Try localStorage directly in case zustand didn't persist it
          const stored = loadToken();
          if (stored && state) {
            state.accessToken = stored;
            saveToken(stored);
          }
        }
      },
    }
  )
);

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  addTransactionOpen: false,
  setAddTransactionOpen: (v) => set({ addTransactionOpen: v }),
}));

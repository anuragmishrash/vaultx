import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        window.__vaultAccessToken = accessToken;
        set({ user, accessToken, isAuthenticated: true });
      },

      setAccessToken: (token) => {
        window.__vaultAccessToken = token;
        set({ accessToken: token });
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      logout: () => {
        window.__vaultAccessToken = null;
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'vault-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // Clear stale access token on reload (it's in memory only)
        if (state) state.accessToken = null;
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

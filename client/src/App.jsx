import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore, useUIStore } from './store/authStore';
import { useIsMobile, useIsTablet } from './hooks/useMediaQuery';
import { useSocket } from './hooks/useSocket';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import Navbar from './components/layout/Navbar';
import AddTransactionModal from './components/features/AddTransactionModal';
import { CardSkeleton } from './components/ui/Skeleton';
import axios from 'axios';
import { usePageTransition } from './utils/animations';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const RegretTracker = lazy(() => import('./pages/RegretTracker'));
const MoodSpend = lazy(() => import('./pages/MoodSpend'));
const GhostMoney = lazy(() => import('./pages/GhostMoney'));
const FutureSelf = lazy(() => import('./pages/FutureSelf'));
const SpendDNA = lazy(() => import('./pages/SpendDNA'));
const ZeroDay = lazy(() => import('./pages/ZeroDay'));
const GuiltyFreeZone = lazy(() => import('./pages/GuiltyFreeZone'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Commitments = lazy(() => import('./pages/Commitments'));
const Settings = lazy(() => import('./pages/Settings'));
const MyMoney = lazy(() => import('./pages/MyMoney'));
const CashTracker = lazy(() => import('./pages/CashTracker'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,         // 2 min — prevents burst on every mount
      gcTime:    10 * 60 * 1000,         // 10 min cache
      refetchOnWindowFocus: false,        // don't refetch on tab switch
      retry: (failureCount, error) => {
        const s = error?.response?.status;
        if (s === 401 || s === 403 || s === 429) return false; // never retry auth/rate errors
        return failureCount < 2;
      },
      retryDelay: (i) => Math.min(1000 * 2 ** i, 10000), // exponential backoff
    },
    mutations: { retry: false },
  },
});

// ── Module-level flag — survives React StrictMode double-mount ──
let authBootstrapped = false;

// ── AuthProvider — restores session from httpOnly refresh cookie on page load ──
// Uses native fetch (not axios) to avoid interceptor interference.
function AuthProvider({ children }) {
  const { setAuth, setUnauthenticated } = useAuthStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || authBootstrapped) {
      return;
    }
    initRef.current  = true;
    authBootstrapped = true;

    const restoreSession = async () => {
      try {
        const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

        // Use native fetch — NOT axios — to avoid interceptor loops
        const res = await fetch(`${BASE}/auth/refresh-token`, {
          method:      'POST',
          credentials: 'include',    // sends httpOnly cookie cross-origin
          headers:     { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          // 401 = session expired, 404 = route not deployed, 204 = backend bug
          console.warn(`[Auth] Refresh failed: HTTP ${res.status}`);
          setUnauthenticated();
          return;
        }

        const data = await res.json();

        if (!data.accessToken || !data.user) {
          console.error('[Auth] refresh-token response missing accessToken or user:', data);
          setUnauthenticated();
          return;
        }

        // Store token for axios interceptor
        window.__vaultAccessToken = data.accessToken;
        try { localStorage.setItem('vault_access_token', data.accessToken); } catch {}

        // Atomically restore full session — unblocks ProtectedLayout + useAuthQuery
        setAuth(data.user, data.accessToken);
        console.log('[Auth] ✓ Session restored for:', data.user.email || data.user.name);

      } catch (err) {
        // Network error, server sleeping, offline
        console.warn('[Auth] Restore failed:', err.message);
        setUnauthenticated();
      }
    };

    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
}

// ── Loading splash shown while session is restoring ──
function VaultSplash() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-5" style={{ background: '#05060F' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'linear-gradient(145deg,#F7B733,#E08A00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 32px rgba(245,166,35,0.45)',
        animation: 'vaultPulse 1.4s ease-in-out infinite',
      }}>
        <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 22 }}>V</span>
      </div>
      <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 16, color: '#EAEDF5', margin: 0 }}>VAULT</p>
      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4E65', margin: 0 }}>Restoring your session…</p>
      <style>{`
        @keyframes vaultPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 32px rgba(245,166,35,0.45); }
          50%       { transform: scale(1.07); box-shadow: 0 0 52px rgba(245,166,35,0.65); }
        }
      `}</style>
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuthStore();
  const { sidebarCollapsed, addTransactionOpen, setAddTransactionOpen } = useUIStore();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Real-time updates — connect socket for entire authenticated session
  useSocket();

  // Still restoring session — show splash (prevents flash of login + 401 cascade)
  if (isLoading || isLoggingOut) return <VaultSplash />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const location = useLocation();
  const pageTransition = usePageTransition();

  // Sidebar width: mobile=0, tablet=64 (icon-only), desktop=64 or 240
  const marginLeft = isMobile ? 0 : isTablet ? 64 : (sidebarCollapsed ? 64 : 240);

  return (
    <>
      {/* Ambient background */}
      <div className="app-bg" aria-hidden="true"><div className="app-bg-blob3" /></div>

      <div className="flex min-h-screen" style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar />
        <Navbar />
        <main
          className="flex-1 transition-all duration-300 pt-14 md:pt-0 pb-20 md:pb-0"
          style={{ marginLeft, minWidth: 0 }}
        >
          <div className="p-4 md:p-8">
            <Suspense fallback={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-[1100px] mx-auto">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            }>
              <motion.div
                key={location.pathname}
                {...pageTransition}
              >
                <Outlet />
              </motion.div>
            </Suspense>
          </div>
        </main>
        <MobileNav />
        <AddTransactionModal isOpen={addTransactionOpen} onClose={() => setAddTransactionOpen(false)} />
      </div>
    </>
  );
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  // While loading, don't redirect — wait for session restore
  if (isLoading) return <VaultSplash />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'toast-custom',
              success: { iconTheme: { primary: '#00C9A7', secondary: '#05060F' } },
              error: { iconTheme: { primary: '#FF5C5C', secondary: '#05060F' } },
            }}
          />
          <Suspense fallback={<VaultSplash />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/commitments" element={<Commitments />} />
                <Route path="/regret-tracker" element={<RegretTracker />} />
                <Route path="/mood-spend" element={<MoodSpend />} />
                <Route path="/ghost-money" element={<GhostMoney />} />
                <Route path="/future-self" element={<FutureSelf />} />
                <Route path="/spend-dna" element={<SpendDNA />} />
                <Route path="/zero-day" element={<ZeroDay />} />
                <Route path="/guilt-free" element={<GuiltyFreeZone />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/my-money" element={<MyMoney />} />
                <Route path="/cash-tracker" element={<CashTracker />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

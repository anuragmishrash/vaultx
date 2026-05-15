import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useAuthStore, useUIStore } from './store/authStore';
import { useIsMobile, useIsTablet } from './hooks/useMediaQuery';
import { useSocket } from './hooks/useSocket';
import { useServerReconnect } from './hooks/useServerReconnect';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import Navbar from './components/layout/Navbar';
import AddTransactionModal from './components/features/AddTransactionModal';
import { CardSkeleton } from './components/ui/Skeleton';
import { usePageTransition } from './utils/animations';

const Landing      = lazy(() => import('./pages/Landing'));
const Login        = lazy(() => import('./pages/Auth/Login'));
const Register     = lazy(() => import('./pages/Auth/Register'));
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const RegretTracker  = lazy(() => import('./pages/RegretTracker'));
const MoodSpend    = lazy(() => import('./pages/MoodSpend'));
const GhostMoney   = lazy(() => import('./pages/GhostMoney'));
const FutureSelf   = lazy(() => import('./pages/FutureSelf'));
const SpendDNA     = lazy(() => import('./pages/SpendDNA'));
const ZeroDay      = lazy(() => import('./pages/ZeroDay'));
const GuiltyFreeZone = lazy(() => import('./pages/GuiltyFreeZone'));
const Analytics    = lazy(() => import('./pages/Analytics'));
const Commitments  = lazy(() => import('./pages/Commitments'));
const Settings     = lazy(() => import('./pages/Settings'));
const MyMoney      = lazy(() => import('./pages/MyMoney'));
const CashTracker  = lazy(() => import('./pages/CashTracker'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime:    10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const s = error?.response?.status;
        if (s === 401 || s === 403 || s === 429) return false;
        return failureCount < 2;
      },
      retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
    },
    mutations: { retry: false },
  },
});

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Module-level flag — prevents double-run in React StrictMode ──
let authBootstrapped = false;

// ── Single refresh-token call with configurable timeout ──────────────────────
async function callRefreshToken(timeoutMs = 50000) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${BASE}/auth/refresh-token`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      signal:      controller.signal,
    });
    clearTimeout(tid);

    if (res.status === 401) return { type: 'expired' };
    if (res.status === 200) {
      const data = await res.json();
      if (data?.accessToken && data?.user) return { type: 'ok', data };
      return { type: 'backend_bug', detail: 'Missing accessToken or user in response' };
    }
    return { type: 'server_error', status: res.status };
  } catch (err) {
    if (err.name === 'AbortError') return { type: 'timeout' };
    return { type: 'network_error', message: err.message };
  }
}

// ── AuthProvider ─────────────────────────────────────────────────────────────
// Two paths:
//   A) Cached session exists → show app immediately, verify in background (50s timeout)
//   B) No cache             → wait for server (50s timeout), show loading screen
function AuthProvider({ children }) {
  const {
    setAuthenticated, setUnauthenticated, setServerUnreachable,
    sessionFromCache, user, accessToken,
  } = useAuthStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || authBootstrapped) return;
    initRef.current  = true;
    authBootstrapped = true;

    const restore = async () => {
      // ── PATH A: Cached session ────────────────────────────────────────────
      if (sessionFromCache && user && accessToken) {
        console.log('[Auth] Cached session found — app visible immediately. Verifying in background…');
        // UI is already unblocked (isLoading=false, isAuthenticated=true from store init)

        const result = await callRefreshToken(50000);

        if (result.type === 'ok') {
          setAuthenticated(result.data.user, result.data.accessToken);
          console.log('[Auth] ✓ Background verify complete — fresh token stored.');
          // Invalidate all queries so they refetch with the new token
          queryClient.invalidateQueries();
        } else if (result.type === 'expired') {
          console.log('[Auth] Cached session expired (401). Redirecting to login.');
          setUnauthenticated();
          // Navigate happens in ProtectedLayout when isAuthenticated → false
        } else {
          // Server sleeping or network issue — keep using cached session
          // useServerReconnect will poll every 8s in the background
          console.warn(`[Auth] Background verify failed (${result.type}) — using cached data. Reconnect polling active.`);
          setServerUnreachable();
        }
        return;
      }

      // ── PATH B: No cache — must wait for server ───────────────────────────
      console.log('[Auth] No cached session — waiting for server (up to 50s)…');
      const result = await callRefreshToken(50000);

      if (result.type === 'ok') {
        setAuthenticated(result.data.user, result.data.accessToken);
        console.log('[Auth] ✓ Fresh session established.');
      } else if (result.type === 'expired') {
        setUnauthenticated();
        // ProtectedLayout handles redirect when !isAuthenticated
      } else {
        // Server couldn't be reached — show reconnecting screen
        console.warn(`[Auth] Server unreachable (${result.type}). Showing reconnect UI.`);
        setServerUnreachable();
      }
    };

    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
}

// ── Screens ──────────────────────────────────────────────────────────────────
function VaultSplash() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: '#05060F' }}>
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

function ReconnectingScreen() {
  const [dots,    setDots]    = useState('.');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const dI = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600);
    const tI = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(dI); clearInterval(tI); };
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#05060F', gap: '20px', padding: '24px',
    }}>
      <div style={{
        width: 54, height: 54, borderRadius: 15,
        background: 'linear-gradient(145deg,#F7B733,#E08A00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 32px rgba(245,166,35,0.3)',
        animation: 'vPulse 2s ease-in-out infinite',
      }}>
        <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 23 }}>V</span>
      </div>
      <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#EAEDF5', margin: 0 }}>VAULT</p>
      <div style={{ textAlign: 'center', maxWidth: 300 }}>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9295A8', margin: '0 0 8px' }}>
          Connecting to server{dots}
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#4A4E65', margin: 0, lineHeight: 1.6 }}>
          {elapsed < 20
            ? 'Our server wakes up on first use. This takes about 30 seconds.'
            : elapsed < 50
            ? 'Almost there… server is starting up.'
            : 'Taking longer than usual. Check your connection.'}
        </p>
      </div>
      {elapsed >= 40 && (
        <button
          onClick={() => { authBootstrapped = false; window.location.reload(); }}
          style={{
            padding: '11px 28px', borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(245,166,35,0.18),rgba(245,166,35,0.07))',
            border: '0.5px solid rgba(245,166,35,0.4)',
            color: '#F5A623', fontFamily: 'Inter', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
          Try again
        </button>
      )}
      <style>{`
        @keyframes vPulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.06); opacity:0.8; } }
      `}</style>
    </div>
  );
}

// ── ProtectedLayout ───────────────────────────────────────────────────────────
function ProtectedLayout() {
  const {
    isAuthenticated, isLoading, isLoggingOut, serverUnreachable,
  } = useAuthStore();
  const { sidebarCollapsed, addTransactionOpen, setAddTransactionOpen } = useUIStore();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const pageTransition = usePageTransition();

  // Real-time sync (only connects when authenticated)
  useSocket();

  // Background reconnect polling when server was unreachable
  useServerReconnect();

  // Still restoring (no cache case)
  if (isLoading || isLoggingOut) return <VaultSplash />;

  // Server unreachable AND no cached session → reconnecting screen
  if (serverUnreachable && !isAuthenticated) return <ReconnectingScreen />;

  // Genuine auth failure (401) → login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // serverUnreachable + isAuthenticated → cached session, show app normally
  // useServerReconnect polls in background, invalidates queries on reconnect

  const marginLeft = isMobile ? 0 : isTablet ? 64 : (sidebarCollapsed ? 64 : 240);

  return (
    <>
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
              <motion.div key={location.pathname} {...pageTransition}>
                <Outlet />
              </motion.div>
            </Suspense>
          </div>
        </main>
        <MobileNav />
        <AddTransactionModal
          isOpen={addTransactionOpen}
          onClose={() => setAddTransactionOpen(false)}
        />
      </div>
    </>
  );
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
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
              error:   { iconTheme: { primary: '#FF5C5C', secondary: '#05060F' } },
            }}
          />
          <Suspense fallback={<VaultSplash />}>
            <Routes>
              <Route path="/"         element={<Landing />} />
              <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard"     element={<Dashboard />} />
                <Route path="/transactions"  element={<Transactions />} />
                <Route path="/commitments"   element={<Commitments />} />
                <Route path="/regret-tracker" element={<RegretTracker />} />
                <Route path="/mood-spend"    element={<MoodSpend />} />
                <Route path="/ghost-money"   element={<GhostMoney />} />
                <Route path="/future-self"   element={<FutureSelf />} />
                <Route path="/spend-dna"     element={<SpendDNA />} />
                <Route path="/zero-day"      element={<ZeroDay />} />
                <Route path="/guilt-free"    element={<GuiltyFreeZone />} />
                <Route path="/analytics"     element={<Analytics />} />
                <Route path="/settings"      element={<Settings />} />
                <Route path="/my-money"      element={<MyMoney />} />
                <Route path="/cash-tracker"  element={<CashTracker />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

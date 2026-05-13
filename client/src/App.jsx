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

// ── Module-level flag — survives React StrictMode double-mount ──
let authBootstrapped = false;

// ── Attempt refresh-token with retries for network errors ──
async function attemptRefresh(maxAttempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${BASE}/auth/refresh-token`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        signal:      controller.signal,
      });
      clearTimeout(timeoutId);

      // 401 = genuine auth failure — don't retry
      if (res.status === 401) {
        return { type: 'auth_failure' };
      }

      // 200 = success — parse and validate
      if (res.status === 200) {
        const data = await res.json();
        if (data.accessToken && data.user) {
          return { type: 'success', data };
        }
        return { type: 'backend_bug', message: 'Response missing accessToken or user' };
      }

      // 404, 204, etc. = backend bug — don't retry
      if (res.status === 404 || res.status === 204) {
        return { type: 'backend_bug', message: `Endpoint returned ${res.status}` };
      }

      // 500 etc. — retry
      lastError = new Error(`HTTP ${res.status}`);

    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const waitMs = attempt * 2000;
        console.log(`[Auth] Attempt ${attempt} failed (${err.message}). Retrying in ${waitMs}ms…`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  return { type: 'network_error', error: lastError };
}

// ── AuthProvider — restores session on page load ──
function AuthProvider({ children }) {
  const { setAuth, setUnauthenticated, setServerUnreachable } = useAuthStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || authBootstrapped) return;
    initRef.current  = true;
    authBootstrapped = true;

    const restore = async () => {
      const result = await attemptRefresh(3);

      if (result.type === 'success') {
        // ✅ Session restored
        window.__vaultAccessToken = result.data.accessToken;
        try { localStorage.setItem('vault_access_token', result.data.accessToken); } catch {}
        setAuth(result.data.user, result.data.accessToken);
        console.log('[Auth] ✓ Session restored for:', result.data.user.email || result.data.user.name);

      } else if (result.type === 'auth_failure') {
        // ❌ 401 — token expired, user must log in
        console.log('[Auth] Token expired → login.');
        setUnauthenticated();

      } else {
        // ⚠️ Network error or backend bug — DON'T redirect to login
        console.warn(`[Auth] ${result.type}:`, result.message || result.error?.message);
        setServerUnreachable();
      }
    };

    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
}

// ── Loading splash ──
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

// ── Reconnecting screen — server sleeping / backend bug ──
// Polls /health every 5s and auto-reloads when server wakes up
function ReconnectingScreen() {
  const [dots, setDots] = useState('.');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const dI = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500);
    const tI = setInterval(() => setElapsed(e => e + 1), 1000);

    // Auto-poll /health — reload when server is back
    const hI = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          clearInterval(hI);
          authBootstrapped = false;           // allow re-bootstrap
          window.location.reload();
        }
      } catch { /* still sleeping */ }
    }, 5000);

    return () => { clearInterval(dI); clearInterval(tI); clearInterval(hI); };
  }, []);

  const handleRetry = () => {
    authBootstrapped = false;
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#05060F', gap: '20px', padding: '20px',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'linear-gradient(145deg,#F7B733,#E08A00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 32px rgba(245,166,35,0.3)',
        animation: 'vaultPulse 2s ease-in-out infinite',
      }}>
        <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 22 }}>V</span>
      </div>
      <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#EAEDF5', margin: 0 }}>VAULT</p>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9295A8', margin: '0 0 6px' }}>
          Connecting to server{dots}
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#4A4E65', margin: 0, maxWidth: 280 }}>
          {elapsed < 15
            ? 'Server is waking up. This takes 20–40 seconds on first load.'
            : 'Taking longer than usual. Check your internet connection.'}
        </p>
      </div>
      {elapsed >= 20 && (
        <button
          onClick={handleRetry}
          style={{
            padding: '10px 24px', borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(245,166,35,0.16),rgba(245,166,35,0.06))',
            border: '0.5px solid rgba(245,166,35,0.4)',
            color: '#F5A623', fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', marginTop: 8,
          }}>
          Try again
        </button>
      )}
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading, isLoggingOut, serverUnreachable } = useAuthStore();
  const { sidebarCollapsed, addTransactionOpen, setAddTransactionOpen } = useUIStore();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Real-time updates
  useSocket();

  // Still restoring — show splash
  if (isLoading || isLoggingOut) return <VaultSplash />;

  // Server unreachable — show reconnecting, DON'T redirect to login
  if (serverUnreachable) return <ReconnectingScreen />;

  // Genuine auth failure — redirect to login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const location = useLocation();
  const pageTransition = usePageTransition();
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
        <AddTransactionModal isOpen={addTransactionOpen} onClose={() => setAddTransactionOpen(false)} />
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

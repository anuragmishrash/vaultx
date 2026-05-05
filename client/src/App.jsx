import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore, useUIStore } from './store/authStore';
import { useIsMobile, useIsTablet } from './hooks/useMediaQuery';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import Navbar from './components/layout/Navbar';
import AddTransactionModal from './components/features/AddTransactionModal';
import { CardSkeleton } from './components/ui/Skeleton';
import axios from 'axios';

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
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

// ── Silently restore access token from httpOnly refresh cookie on page load ──
function TokenRefresher({ children }) {
  const { isAuthenticated, setAccessToken, logout } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !window.__vaultAccessToken) {
      axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh-token`,
        {},
        { withCredentials: true }
      )
        .then(({ data }) => {
          if (data.accessToken) {
            window.__vaultAccessToken = data.accessToken;
            setAccessToken(data.accessToken);
          }
        })
        .catch(() => {
          // Refresh cookie expired — force re-login
          logout();
        })
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#05060F' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(145deg,#F7B733,#E08A00)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 20 }}>V</span>
        </div>
      </div>
    );
  }

  return children;
}

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();
  const { sidebarCollapsed, addTransactionOpen, setAddTransactionOpen } = useUIStore();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const location = useLocation();

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
                initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.38, ease: [0.16,1,0.3,1] } }}
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
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TokenRefresher>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'toast-custom',
              success: { iconTheme: { primary: '#00C9A7', secondary: '#05060F' } },
              error: { iconTheme: { primary: '#FF5C5C', secondary: '#05060F' } },
            }}
          />
          <Suspense fallback={
            <div className="h-screen flex items-center justify-center" style={{ background: '#05060F' }}>
              <div className="logo-pulse" style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(145deg,#F7B733,#E08A00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 20 }}>V</span>
              </div>
            </div>
          }>
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
        </TokenRefresher>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

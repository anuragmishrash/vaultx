import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, Plus, Wallet,
  LayoutDashboard, ArrowLeftRight, Banknote, Landmark,
  Heart, Brain, Ghost, TrendingUp, Dna, Zap, Shield, BarChart3, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUIStore } from '../../store/authStore';

const ALL_NAV_ITEMS = [
  { path: '/my-money',       icon: Wallet,          label: 'My Money' },
  { path: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions',   icon: ArrowLeftRight,  label: 'Transactions' },
  { path: '/cash-tracker',   icon: Banknote,        label: 'Cash Tracker' },
  { path: '/commitments',    icon: Landmark,        label: 'Commitments' },
  { path: '/regret-tracker', icon: Heart,           label: 'Regret Tracker' },
  { path: '/mood-spend',     icon: Brain,           label: 'Mood & Spend' },
  { path: '/ghost-money',    icon: Ghost,           label: 'Ghost Money' },
  { path: '/future-self',    icon: TrendingUp,      label: 'Future Self' },
  { path: '/spend-dna',      icon: Dna,             label: 'Spend DNA' },
  { path: '/zero-day',       icon: Zap,             label: 'Zero-Day' },
  { path: '/guilt-free',     icon: Shield,          label: 'Guilt-Free' },
  { path: '/analytics',      icon: BarChart3,       label: 'Analytics' },
  { path: '/settings',       icon: Settings,        label: 'Settings' },
];

export default function Navbar() {
  const { user } = useAuthStore();
  const { setAddTransactionOpen } = useUIStore();
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* ── Top navigation bar ─────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 flex items-center justify-between px-4"
        style={{
          height: 56,
          zIndex: 600,   /* above drawer backdrop (500) so bar stays visible */
          background: 'rgba(5,6,15,0.92)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setShowSideDrawer(true)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#EAEDF5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 44, minHeight: 44,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            marginLeft: -8,
          }}
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(145deg,#F7B733,#E08A00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(245,166,35,0.3)',
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 11 }}>V</span>
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: '#EAEDF5' }}>VAULT</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddTransactionOpen(true)}
            style={{
              padding: 8, color: '#EAEDF5', background: 'none', border: 'none', cursor: 'pointer',
              minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Plus size={22} />
          </button>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(145deg,#9B8AFB,#7165E0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#180850', fontFamily: 'Outfit',
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* ── Side drawer — rendered OUTSIDE header so z-index works correctly ── */}
      <AnimatePresence>
        {showSideDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSideDrawer(false)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.65)',
                zIndex: 550,    /* below drawer panel but above everything else */
              }}
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer-panel"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: '80%', maxWidth: 280,
                background: 'rgba(6,7,18,0.99)',
                backdropFilter: 'blur(20px)',
                borderRight: '0.5px solid rgba(255,255,255,0.08)',
                zIndex: 560,
                overflowY: 'auto',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Logo row */}
              <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(145deg,#F7B733,#E08A00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 14 }}>V</span>
                  </div>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#EAEDF5' }}>VAULT</span>
                </div>
              </div>

              {/* Nav items */}
              <nav style={{ padding: 12 }}>
                {ALL_NAV_ITEMS.map(item => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  return (
                    <Link key={item.path} to={item.path}
                      onClick={() => setShowSideDrawer(false)}
                      style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 12,
                        background: isActive ? 'linear-gradient(135deg,rgba(245,166,35,0.13),rgba(245,166,35,0.04))' : 'transparent',
                        border: isActive ? '0.5px solid rgba(245,166,35,0.26)' : '0.5px solid transparent',
                        color: isActive ? '#F5A623' : '#9295A8',
                        fontFamily: 'Inter', fontSize: 14, fontWeight: isActive ? 500 : 400,
                      }}>
                        <item.icon size={17} style={{ flexShrink: 0 }} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* User card */}
              <div style={{ margin: 12, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(145deg,#9B8AFB,#7165E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: 14, color: '#180850', flexShrink: 0 }}>
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#EAEDF5', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#4A4E65', margin: 0 }}>Tap to manage account</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

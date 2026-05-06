import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, Plus, Bell, LayoutDashboard, ArrowLeftRight, Banknote, Landmark, Heart, Brain, Ghost, TrendingUp, Dna, Zap, Shield, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUIStore } from '../../store/authStore';

const ALL_NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/cash-tracker', icon: Banknote, label: 'Cash Tracker' },
  { path: '/commitments', icon: Landmark, label: 'Commitments' },
  { path: '/regret-tracker', icon: Heart, label: 'Regret Tracker' },
  { path: '/mood-spend', icon: Brain, label: 'Mood & Spend' },
  { path: '/ghost-money', icon: Ghost, label: 'Ghost Money' },
  { path: '/future-self', icon: TrendingUp, label: 'Future Self' },
  { path: '/spend-dna', icon: Dna, label: 'Spend DNA' },
  { path: '/zero-day', icon: Zap, label: 'Zero-Day' },
  { path: '/guilt-free', icon: Shield, label: 'Guilt-Free' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Navbar() {
  const { user } = useAuthStore();
  const { setAddTransactionOpen } = useUIStore();
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const location = useLocation();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 56,
        background: 'rgba(5,6,15,0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      }}>
      <button
        onClick={() => setShowSideDrawer(true)}
        style={{
          background: 'transparent', border: 'none',
          padding: '8px', cursor: 'pointer',
          color: '#EAEDF5', display: 'flex', alignItems: 'center',
          minWidth: '44px', minHeight: '44px',
          touchAction: 'manipulation',
          zIndex: 101,
          marginLeft: '-8px'
        }}>
        <Menu size={22} />
      </button>

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

      <div className="flex items-center gap-2">
        <button onClick={() => setAddTransactionOpen(true)}
          style={{ padding: 8, color: '#9295A8', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Plus size={22} />
        </button>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(145deg,#9B8AFB,#7165E0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, color: '#180850', fontFamily: 'Outfit'
        }}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>

      <AnimatePresence>
        {showSideDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSideDrawer(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500 }} />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: '280px',
                background: 'rgba(6,7,18,0.98)', backdropFilter: 'blur(20px)',
                borderRight: '0.5px solid rgba(255,255,255,0.08)',
                zIndex: 501, overflowY: 'auto',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}>
              {/* Logo */}
              <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(145deg,#F7B733,#E08A00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: '14px' }}>V</span>
                  </div>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '18px', color: '#EAEDF5' }}>VAULT</span>
                </div>
              </div>

              {/* All nav items */}
              <nav style={{ padding: '12px' }}>
                {ALL_NAV_ITEMS.map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link key={item.path} to={item.path}
                      onClick={() => setShowSideDrawer(false)}
                      style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '12px',
                        background: isActive ? 'linear-gradient(135deg,rgba(245,166,35,0.13),rgba(245,166,35,0.04))' : 'transparent',
                        border: isActive ? '0.5px solid rgba(245,166,35,0.26)' : '0.5px solid transparent',
                        color: isActive ? '#F5A623' : '#9295A8',
                        fontFamily: 'Inter', fontSize: '14px', fontWeight: isActive ? 500 : 400,
                      }}>
                        <item.icon size={17} style={{ flexShrink: 0 }} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* User info */}
              <div style={{ margin: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(145deg,#9B8AFB,#7165E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: '14px', color: '#180850', flexShrink: 0 }}>
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontFamily: 'Inter', fontSize: '13px', fontWeight: 500, color: '#EAEDF5', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: 0 }}>Tap to manage account</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

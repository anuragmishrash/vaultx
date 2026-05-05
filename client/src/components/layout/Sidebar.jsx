import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ArrowLeftRight, Heart, Brain, Ghost,
  TrendingUp, Dna, Zap, Shield, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Landmark, Banknote, Wallet
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store/authStore';
import { useIsTablet } from '../../hooks/useMediaQuery';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const isWalletMode = user?.moneyMode === 'wallet';

  // On tablets, always use icon-only mode
  const collapsed = isTablet || sidebarCollapsed;

  const NAV_ITEMS = [
    ...(isWalletMode ? [{ to: '/my-money', icon: Wallet, label: 'My Money' }] : []),
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
    { to: '/cash-tracker', icon: Banknote, label: 'Cash Tracker' },
    { to: '/commitments', icon: Landmark, label: 'Commitments' },
    { to: '/regret-tracker', icon: Heart, label: 'Regret Tracker' },
    { to: '/mood-spend', icon: Brain, label: 'Mood & Spend' },
    { to: '/ghost-money', icon: Ghost, label: 'Ghost Money' },
    { to: '/future-self', icon: TrendingUp, label: 'Future Self' },
    { to: '/spend-dna', icon: Dna, label: 'Spend DNA' },
    { to: '/zero-day', icon: Zap, label: 'Zero-Day' },
    { to: '/guilt-free', icon: Shield, label: 'Guilt-Free' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { }
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40"
      style={{
        background: 'rgba(5,6,18,0.78)',
        backdropFilter: 'blur(24px) saturate(175%)',
        WebkitBackdropFilter: 'blur(24px) saturate(175%)',
        borderRight: '0.5px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 flex-shrink-0" style={{ padding: '0 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(145deg,#F7B733,#E08A00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(245,166,35,0.35)'
              }}>
                <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 15 }}>V</span>
              </div>
              <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#EAEDF5' }}>VAULT</span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div style={{
            width: 34, height: 34, borderRadius: 10, margin: '0 auto',
            background: 'linear-gradient(145deg,#F7B733,#E08A00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,166,35,0.35)'
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 15 }}>V</span>
          </div>
        )}
        {!collapsed && !isTablet && (
          <button onClick={() => setSidebarCollapsed(true)}
            className="p-1 rounded-md hover:bg-white/5 transition-all" style={{ color: '#4A4E65' }}>
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none' }} title={collapsed ? label : undefined}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: collapsed ? '10px 0' : '10px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 12,
                fontFamily: 'Inter', fontSize: 14, fontWeight: isActive ? 500 : 400,
                color: isActive ? '#F5A623' : '#9295A8',
                background: isActive ? 'linear-gradient(135deg,rgba(245,166,35,0.13),rgba(245,166,35,0.04))' : 'transparent',
                border: isActive ? '0.5px solid rgba(245,166,35,0.26)' : '0.5px solid transparent',
                boxShadow: isActive ? '0 0 16px rgba(245,166,35,0.07)' : 'none',
                transition: 'all 0.2s ease',
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
              }}>
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '22%', height: '56%', width: 2.5, background: '#F5A623', borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(245,166,35,0.7)' }} />
                )}
                <Icon size={16} style={{ flexShrink: 0, filter: isActive ? 'drop-shadow(0 0 4px rgba(245,166,35,0.6))' : 'none' }} />
                {!collapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', padding: 12, flexShrink: 0 }}>
        {!collapsed && user && (
          <div style={{
            padding: 12, marginBottom: 8, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(145deg,#9B8AFB,#7165E0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#180850', fontFamily: 'Outfit'
            }}>
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#EAEDF5', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
              <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#4A4E65', margin: 0 }}>{user.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full transition-all"
          style={{
            padding: collapsed ? '8px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'Inter', fontSize: 13, color: '#9295A8',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FF5C5C'; e.currentTarget.style.background = 'rgba(255,92,92,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9295A8'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
        {collapsed && !isTablet && (
          <button onClick={() => setSidebarCollapsed(false)}
            className="flex items-center justify-center w-full p-2 mt-1 rounded-md hover:bg-white/5 transition-all"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#4A4E65' }}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}

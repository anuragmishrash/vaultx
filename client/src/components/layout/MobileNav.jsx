import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, BarChart3, MoreHorizontal, Plus, Banknote, Ghost, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/authStore';

export default function MobileNav() {
  const { setAddTransactionOpen } = useUIStore();
  const navigate = useNavigate();
  const [showFabMenu, setShowFabMenu] = useState(false);
  const pressTimer = useRef(null);

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => setShowFabMenu(true), 500);
  };
  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!showFabMenu) setAddTransactionOpen(true);
  };

  const NAV = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Spends' },
    null, // FAB placeholder
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/settings', icon: MoreHorizontal, label: 'More' },
  ];

  return (
    <>
      {showFabMenu && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowFabMenu(false)} />
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          height: 64,
          background: 'rgba(4,5,16,0.9)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderTop: '0.5px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {NAV.map((item, i) => {
          if (!item) {
            return (
              <div key="fab" className="relative">
                <AnimatePresence>
                  {showFabMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.8 }}
                      className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-3 w-48"
                    >
                      {[
                        { icon: CreditCard, label: 'Regular Spend', color: '#00C9A7', action: () => { setShowFabMenu(false); setAddTransactionOpen(true); } },
                        { icon: Banknote, label: 'Cash Spend', color: '#F5A623', action: () => { setShowFabMenu(false); navigate('/cash-tracker'); } },
                        { icon: Ghost, label: 'Ghost Sub', color: '#9B8AFB', action: () => { setShowFabMenu(false); navigate('/ghost-money'); } },
                      ].map(opt => (
                        <button key={opt.label} onClick={opt.action}
                          className="gc flex items-center gap-3 p-3 text-sm font-medium"
                          style={{ fontFamily: 'Inter', color: '#EAEDF5', borderRadius: 14, cursor: 'pointer', border: 'none' }}>
                          <opt.icon size={18} style={{ color: opt.color }} /> {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onMouseDown={handlePressStart} onMouseUp={handlePressEnd}
                  onMouseLeave={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }}
                  onTouchStart={handlePressStart} onTouchEnd={handlePressEnd}
                  style={{
                    marginTop: -24, border: 'none', background: 'transparent', cursor: 'pointer',
                    WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: showFabMenu ? 'rgba(255,255,255,0.1)' : 'linear-gradient(145deg,#F7B733,#F5A623,#E08A00)',
                    boxShadow: showFabMenu ? 'none' : '0 4px 24px rgba(245,166,35,0.5), inset 0 1px 0 rgba(255,255,255,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    <Plus size={24} style={{
                      color: showFabMenu ? '#fff' : '#1C0E00',
                      transform: showFabMenu ? 'rotate(45deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </div>
                </button>
              </div>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} onClick={() => setShowFabMenu(false)} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, padding: '8px 0', position: 'relative' }}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2.5, background: '#F5A623', borderRadius: '0 0 4px 4px', boxShadow: '0 0 8px rgba(245,166,35,0.8)' }} />
                  )}
                  <item.icon size={20} style={{ color: isActive ? '#F5A623' : '#4A4E65', filter: isActive ? 'drop-shadow(0 0 4px rgba(245,166,35,0.7))' : 'none', transition: 'all 0.2s' }} />
                  <span style={{ fontFamily: 'Inter', fontSize: 10, color: isActive ? '#F5A623' : '#4A4E65', transition: 'all 0.2s' }}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

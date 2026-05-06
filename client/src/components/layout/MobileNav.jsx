import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, BarChart3, MoreHorizontal, Plus, Banknote, Ghost, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/authStore';
import MoreDrawer from './MoreDrawer';

export default function MobileNav() {
  const { setAddTransactionOpen } = useUIStore();
  const navigate = useNavigate();
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const pressTimer = useRef(null);
  const didLongPress = useRef(false);   // tracks whether the 500 ms timer fired

  const handlePressStart = (e) => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowFabMenu(true);
    }, 500);
  };

  const handlePressEnd = (e) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    // Only open the modal on a quick tap (not a long-press)
    if (!didLongPress.current) {
      setAddTransactionOpen(true);
    }
    didLongPress.current = false;
  };

  // Prevent ghost mouse events after touch on mobile
  const handleTouchEnd = (e) => {
    e.preventDefault();   // stops the synthetic 'click' that would fire ~300ms later
    handlePressEnd(e);
  };

  const NAV = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Spends' },
    null, // FAB placeholder
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { isMore: true, icon: MoreHorizontal, label: 'More' },
  ];

  return (
    <>
      <MoreDrawer isOpen={showMoreDrawer} onClose={() => setShowMoreDrawer(false)} />
      
      {showFabMenu && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm" onClick={() => setShowFabMenu(false)} />
      )}

      {/* FAB - Fixed Position */}
      <div style={{ zIndex: 200, position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)' }}>
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
          onTouchStart={handlePressStart} onTouchEnd={handleTouchEnd}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: showFabMenu ? 'rgba(255,255,255,0.1)' : 'linear-gradient(145deg, #F7B733, #F5A623, #E08A00)',
            boxShadow: showFabMenu ? 'none' : '0 4px 24px rgba(245,166,35,0.55), 0 0 0 0.5px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.22)',
            border: showFabMenu ? 'none' : '3px solid rgba(5,6,15,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <span style={{ fontSize: '26px', color: showFabMenu ? '#fff' : '#1C0E00', fontWeight: 300, lineHeight: 1, marginTop: '-1px', transform: showFabMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>
              +
            </span>
          </div>
        </button>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-around"
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
            return <div key="fab-placeholder" style={{ width: 58 }} />;
          }

          if (item.isMore) {
            return (
              <button key="more" onClick={() => { setShowFabMenu(false); setShowMoreDrawer(true); }} style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, padding: '8px 0', cursor: 'pointer' }}>
                <item.icon size={20} style={{ color: showMoreDrawer ? '#F5A623' : '#4A4E65', filter: showMoreDrawer ? 'drop-shadow(0 0 4px rgba(245,166,35,0.7))' : 'none', transition: 'all 0.2s' }} />
                <span style={{ fontFamily: 'Inter', fontSize: 10, color: showMoreDrawer ? '#F5A623' : '#4A4E65', transition: 'all 0.2s' }}>{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} onClick={() => { setShowFabMenu(false); setShowMoreDrawer(false); }} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, padding: '8px 0', position: 'relative' }}>
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

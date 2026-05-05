import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Ghost, TrendingUp, Dna, Flame, Gift,
  Wallet, Target, BarChart2, Settings, X
} from 'lucide-react';

const MORE_NAV_ITEMS = [
  { path: '/commitments',   label: 'Commitments',  icon: Target },
  { path: '/regret-tracker',label: 'Regret',       icon: Flame },
  { path: '/mood-spend',    label: 'Mood & Spend', icon: TrendingUp },
  { path: '/ghost-money',   label: 'Ghost Money',  icon: Ghost },
  { path: '/future-self',   label: 'Future Self',  icon: TrendingUp },
  { path: '/spend-dna',     label: 'Spend DNA',    icon: Dna },
  { path: '/zero-day',      label: 'Zero-Day',     icon: Flame },
  { path: '/guilt-free',    label: 'Guilt-Free',   icon: Gift },
  { path: '/cash-tracker',  label: 'Cash',         icon: Wallet },
  { path: '/settings',      label: 'Settings',     icon: Settings },
];

export default function MoreDrawer({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 400 }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 0, left: 0, right: 0,
              zIndex: 401,
              background: 'rgba(8, 9, 22, 0.97)',
              backdropFilter: 'blur(24px)',
              borderTop: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            }}>

            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
              <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '16px', color: '#EAEDF5', margin: 0 }}>
                More
              </p>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#9295A8', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Nav items — 2 columns grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 16px' }}>
              {MORE_NAV_ITEMS.map(item => (
                <Link key={item.path} to={item.path} onClick={onClose} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px', borderRadius: '14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(245,166,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.icon size={15} color="#F5A623" />
                    </div>
                    <span style={{ fontFamily: 'Inter', fontSize: '13px', fontWeight: 500, color: '#EAEDF5' }}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

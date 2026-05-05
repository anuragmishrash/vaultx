import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Plus, Bell } from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store/authStore';

export default function Navbar({ onMenuClick }) {
  const { user } = useAuthStore();
  const { setAddTransactionOpen } = useUIStore();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 56,
        background: 'rgba(5,6,15,0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      }}>
      <button onClick={onMenuClick} className="p-2 -ml-2" style={{ color: '#9295A8', background: 'none', border: 'none', cursor: 'pointer' }}>
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
    </header>
  );
}

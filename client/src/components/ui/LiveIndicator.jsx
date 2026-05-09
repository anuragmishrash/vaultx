/**
 * LiveIndicator.jsx — small dot showing Socket.IO connection status.
 * Placed next to VAULT logo in Sidebar.
 */

import { useState, useEffect } from 'react';
import { getSocketInstance } from '../../hooks/useSocket';

export default function LiveIndicator() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = () => {
      const s = getSocketInstance();
      setConnected(s?.connected ?? false);
    };

    check(); // immediate check on mount
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      title={connected ? 'Live — updates in real-time' : 'Connecting…'}
      style={{
        width:        7,
        height:       7,
        borderRadius: '50%',
        flexShrink:   0,
        background:   connected ? '#00C9A7' : '#4A4E65',
        boxShadow:    connected ? '0 0 6px rgba(0,201,167,0.75)' : 'none',
        transition:   'background 0.4s ease, box-shadow 0.4s ease',
      }}
    />
  );
}

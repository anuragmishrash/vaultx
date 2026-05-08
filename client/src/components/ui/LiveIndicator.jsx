/**
 * LiveIndicator.jsx — small green/grey dot showing socket connection status
 * Add next to the VAULT logo in the Sidebar.
 */

import { useState, useEffect } from 'react';
import { getSocket } from '../../socket/socketClient';

export default function LiveIndicator() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Poll the socket state — works even if socket connects after mount
    const check = () => {
      const s = getSocket();
      setConnected(s?.connected ?? false);
    };

    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      title={connected ? 'Live updates active' : 'Connecting to real-time...'}
      style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   connected ? '#00C9A7' : '#4A4E65',
        boxShadow:    connected ? '0 0 7px rgba(0,201,167,0.7)' : 'none',
        transition:   'all 0.4s ease',
        flexShrink:   0,
      }}
    />
  );
}

/**
 * useSocket.js — VAULT real-time hook
 * Connects to Socket.IO and invalidates React Query caches on 'data:changed' events.
 * Mount this ONCE in ProtectedLayout — not in individual pages.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace('/api', '');

// Module-level socket — ONE instance for the entire app session
let socketInstance = null;

// Maps 'resource' value from server events → React Query cache keys to invalidate
const RESOURCE_KEYS = {
  transactions: [['transactions'], ['batch-daily'], ['pattern-suggestions-transactions']],
  dashboard:    [['dashboard'], ['chart-data']],
  commitments:  [['commitments'], ['waterfall']],
  waterfall:    [['waterfall']],
  accounts:     [['accounts'], ['accounts-summary'], ['dashboard']],
  'my-money':   [['accounts'], ['net-worth']],
  zeroday:      [['zeroday-streak'], ['zeroday-calendar'], ['dashboard']],
  cash:         [['cash-envelope'], ['dashboard']],
  mood:         [['mood'], ['mood-correlation']],
};

export function getSocketInstance() {
  return socketInstance;
}

export function useSocket() {
  const queryClient   = useQueryClient();
  const { accessToken, isAuthenticated } = useAuthStore();
  const listenersRef  = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Create or reconnect socket if needed
    if (!socketInstance || !socketInstance.connected) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }

      socketInstance = io(SOCKET_URL, {
        auth:               { token: accessToken },
        transports:         ['websocket', 'polling'],
        reconnection:       true,
        reconnectionAttempts: 10,
        reconnectionDelay:  2000,
        reconnectionDelayMax: 10000,
        timeout:            20000,
      });

      if (typeof socketInstance.setMaxListeners === 'function') {
        socketInstance.setMaxListeners(20);
      }
    }

    // Prevent attaching duplicate listeners across re-renders
    if (listenersRef.current) return;
    listenersRef.current = true;

    const handleConnect = () => {
      console.log('[Socket] ✅ Connected:', socketInstance.id);
    };

    const handleDisconnect = (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us explicitly — try to reconnect
        socketInstance.connect();
      }
    };

    const handleConnectError = (err) => {
      // Non-fatal — app continues to work, just no real-time updates
      console.warn('[Socket] Connection error (real-time disabled):', err.message);
    };

    const handleDataChanged = ({ resource, action }) => {
      console.log(`[Socket] 🔄 data:changed → ${resource} (${action})`);

      const keys = RESOURCE_KEYS[resource] || [];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleConnectError);
    socketInstance.on('data:changed', handleDataChanged);

    return () => {
      // Remove listeners on cleanup but KEEP the socket alive across navigation
      if (socketInstance) {
        socketInstance.off('connect', handleConnect);
        socketInstance.off('disconnect', handleDisconnect);
        socketInstance.off('connect_error', handleConnectError);
        socketInstance.off('data:changed', handleDataChanged);
      }
      listenersRef.current = false;
    };
  }, [isAuthenticated, accessToken]); // re-run if token changes (e.g. after login)

  // Disconnect socket when user logs out
  useEffect(() => {
    return () => {
      if (!useAuthStore.getState().isAuthenticated && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, []);
}

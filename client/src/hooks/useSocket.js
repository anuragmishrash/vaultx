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
    }

    // Prevent attaching duplicate listeners across re-renders
    if (listenersRef.current) return;
    listenersRef.current = true;

    socketInstance.on('connect', () => {
      console.log('[Socket] ✅ Connected:', socketInstance.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us explicitly — try to reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (err) => {
      // Non-fatal — app continues to work, just no real-time updates
      console.warn('[Socket] Connection error (real-time disabled):', err.message);
    });

    // ── THE ONLY EVENT WE LISTEN FOR ────────────────────────────────────────
    // Server emits 'data:changed' with { resource, action } after every mutation.
    // We look up which React Query keys to invalidate for that resource.
    socketInstance.on('data:changed', ({ resource, action }) => {
      console.log(`[Socket] 🔄 data:changed → ${resource} (${action})`);

      const keys = RESOURCE_KEYS[resource] || [];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    });

    return () => {
      // Remove listeners on cleanup but KEEP the socket alive across navigation
      if (socketInstance) {
        socketInstance.off('data:changed');
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('connect_error');
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

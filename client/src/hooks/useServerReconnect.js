/**
 * useServerReconnect.js
 *
 * When serverUnreachable = true, silently polls refresh-token every 8s.
 * When server comes back:
 *   - Gets fresh token → calls setAuthenticated → updates cache
 *   - React Query caches invalidated → fresh data loads automatically
 * User sees their cached data the entire time — no loading screen.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

let BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
if (!BASE.endsWith('/api')) {
  BASE = BASE.replace(/\/$/, '') + '/api';
}

export function useServerReconnect() {
  const { serverUnreachable, setAuthenticated, setUnauthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!serverUnreachable) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tryReconnect = async () => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${BASE}/auth/refresh-token`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          signal:      controller.signal,
        });
        clearTimeout(tid);

        if (res.status === 200) {
          const data = await res.json();
          if (data?.accessToken && data?.user) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;

            setAuthenticated(data.user, data.accessToken);
            console.log('[Reconnect] ✓ Server back online. Session refreshed.');

            // Invalidate all caches so pages refetch with fresh token
            queryClient.invalidateQueries();
          }
        } else if (res.status === 401) {
          // Token expired while offline — must log in
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setUnauthenticated();
          window.location.replace('/login');
        }
        // Any other status (500 etc.) — keep polling silently
      } catch {
        // Fetch threw (network error, timeout) — keep polling silently
      }
    };

    // Try immediately, then every 8 seconds
    tryReconnect();
    intervalRef.current = setInterval(tryReconnect, 8000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [serverUnreachable]); // eslint-disable-line react-hooks/exhaustive-deps
}

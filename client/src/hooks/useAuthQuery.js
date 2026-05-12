/**
 * useAuthQuery.js — Drop-in replacement for useQuery.
 * Prevents queries from firing before authentication is confirmed.
 * This stops the blank-data-on-reopen problem entirely.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

export function useAuthQuery(options) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return useQuery({
    ...options,
    // Only fire when user is authenticated AND caller's own enabled condition is met
    enabled: isAuthenticated && (options.enabled !== false),
  });
}

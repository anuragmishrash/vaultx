/**
 * useSocket.js — VAULT real-time hook
 * Connects to Socket.IO and invalidates React Query caches on server events.
 * Place this ONCE in ProtectedLayout — not in individual pages.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { connectSocket, disconnectSocket } from '../socket/socketClient';

export function useSocket() {
  const queryClient   = useQueryClient();
  const { accessToken, isAuthenticated } = useAuthStore();
  const connectedRef  = useRef(false);

  useEffect(() => {
    // Don't connect without a valid token
    if (!isAuthenticated || !accessToken || connectedRef.current) return;

    const socket = connectSocket(accessToken);
    connectedRef.current = true;

    // ── TRANSACTION EVENTS ──────────────────────────────────────────────────
    const onTxCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['zeroday-streak'] });
      queryClient.invalidateQueries({ queryKey: ['zeroday-calendar'] });
    };

    const onTxUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    };

    const onTxDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['zeroday-streak'] });
    };

    // ── COMMITMENT EVENTS ───────────────────────────────────────────────────
    const onCommitmentPaid = () => {
      queryClient.invalidateQueries({ queryKey: ['waterfall'] });
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // ── ACCOUNT EVENTS ──────────────────────────────────────────────────────
    const onAccountUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['waterfall'] });
    };

    socket.on('transaction:created', onTxCreated);
    socket.on('transaction:updated', onTxUpdated);
    socket.on('transaction:deleted', onTxDeleted);
    socket.on('commitment:paid',     onCommitmentPaid);
    socket.on('account:updated',     onAccountUpdated);

    return () => {
      socket.off('transaction:created', onTxCreated);
      socket.off('transaction:updated', onTxUpdated);
      socket.off('transaction:deleted', onTxDeleted);
      socket.off('commitment:paid',     onCommitmentPaid);
      socket.off('account:updated',     onAccountUpdated);
      connectedRef.current = false;
      disconnectSocket();
    };
  }, [isAuthenticated, accessToken]); // reconnect if token changes
}

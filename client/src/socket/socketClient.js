/**
 * socketClient.js — VAULT Socket.IO client
 * Single connection instance shared across the entire app.
 */

import { io } from 'socket.io-client';

let socket = null;

const SOCKET_URL =
  (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
    .replace('/api', '');

export function connectSocket(token) {
  if (socket?.connected) return socket;

  // Clean up stale disconnected socket before reconnecting
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    // Non-fatal — app works without socket, just no real-time updates
    console.warn('[Socket] Connection failed (real-time disabled):', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

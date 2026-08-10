/**
 * socket.js — VAULT Socket.IO server
 * Handles real-time updates across all connected devices for a user.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(httpServer) {
  const clientUrls = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim().replace(/\/$/, ''))
    : [];

  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        ...clientUrls,
      ],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // Auth middleware — verify JWT before allowing socket connection
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required'));

      const secret  = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      socket.userId = (decoded.id || decoded._id)?.toString();
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  if (typeof io.setMaxListeners === 'function') {
    io.setMaxListeners(20);
  }
  if (io.sockets && typeof io.sockets.setMaxListeners === 'function') {
    io.sockets.setMaxListeners(20);
  }

  io.on('connection', (socket) => {
    if (typeof socket.setMaxListeners === 'function') {
      socket.setMaxListeners(20);
    }
    // Each user gets their own room (all devices share it)
    socket.join(`user:${socket.userId}`);
    console.log(`[Socket] ✅ User ${socket.userId} connected (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ❌ User ${socket.userId} disconnected: ${reason}`);
    });
  });

  console.log('[Socket.IO] Initialized');
  return io;
}

/**
 * Emit a real-time event to ALL devices of a specific user.
 * Safe to call even before socket.io is initialized (no-ops gracefully).
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId.toString()}`).emit(event, {
    ...data,
    _ts: Date.now(),
  });
}

/**
 * safeEmit — unified helper for all controllers.
 * Emits a 'data:changed' event so the frontend knows which cache to invalidate.
 *
 * @param {string|ObjectId} userId   — MongoDB user ID
 * @param {string}          resource — 'transactions' | 'dashboard' | 'commitments' | 'accounts' | 'zeroday' | 'cash' | 'mood'
 * @param {string}          action   — 'created' | 'updated' | 'deleted' | 'paid' | 'refresh'
 */
function safeEmit(userId, resource, action = 'refresh') {
  try {
    if (!userId) return;
    emitToUser(userId.toString(), 'data:changed', {
      resource,
      action,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('[Socket] safeEmit failed:', err.message);
  }
}

module.exports = { initSocket, emitToUser, safeEmit };

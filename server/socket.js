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

  io.on('connection', (socket) => {
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
 *
 * @param {string} userId  — MongoDB ObjectId as string
 * @param {string} event   — event name (e.g. 'transaction:created')
 * @param {object} data    — payload
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId.toString()}`).emit(event, {
    ...data,
    _ts: Date.now(),
  });
}

module.exports = { initSocket, emitToUser };

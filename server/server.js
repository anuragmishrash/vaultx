require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { startJobs } = require('./jobs/cronJobs');

const app        = express();
const httpServer = http.createServer(app);

// Trust the first proxy (Render / Vercel / nginx) — required for express-rate-limit
// to correctly read the real client IP from X-Forwarded-For without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Connect DB
connectDB();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const clientUrls = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, ''))
  : [];

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    ...clientUrls
  ],
  credentials: true,
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Auth endpoints (login/register) — strict
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 30,                    // 30 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// All other API routes — generous (dashboard fires ~10 parallel requests per page load)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1 min window
  max: 300,                   // 300 req/min per IP — plenty for a single-user app
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      retryAfter: 10,
    });
  },
});

// Apply limiters before routes
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api',               apiLimiter);
// ─────────────────────────────────────────────────────────────────────────────

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/user',         require('./routes/user'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/mood',         require('./routes/mood'));
app.use('/api/subscriptions',require('./routes/subscriptions'));
app.use('/api/analytics',    require('./routes/analytics'));
app.use('/api/dna',          require('./routes/dna'));
app.use('/api/zeroday',      require('./routes/zeroday'));
app.use('/api/commitments',  require('./routes/commitments'));
app.use('/api/accounts',     require('./routes/accounts'));
app.use('/api/cash',         require('./routes/cash'));
app.use('/api/patterns',     require('./routes/patterns'));
app.use('/api/income',       require('./routes/income'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));

// Error handler
app.use(errorHandler);

// Start cron jobs
startJobs();

// ── Socket.IO ────────────────────────────────────────────────────────────────
try {
  const { initSocket } = require('./socket');
  initSocket(httpServer);
} catch (e) {
  console.warn('[Socket.IO] Not initialized:', e.message);
}
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 VAULT Server running on port ${PORT}`);

  // ── Keep-alive ping for Render free tier (prevents 30s cold-start sleep) ──
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    const https = require('https');
    const pingUrl = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
    setInterval(() => {
      https.get(pingUrl, (res) => {
        console.log(`[KeepAlive] Ping → ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn('[KeepAlive] Ping failed:', err.message);
      });
    }, 14 * 60 * 1000); // every 14 minutes
    console.log('[KeepAlive] Started — server will stay awake on Render.');
  }
  // ─────────────────────────────────────────────────────────────────────────
});

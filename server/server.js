require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { startJobs } = require('./jobs/cronJobs');

const app = express();

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
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests' }));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/mood', require('./routes/mood'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/dna', require('./routes/dna'));
app.use('/api/zeroday', require('./routes/zeroday'));
app.use('/api/commitments', require('./routes/commitments'));
app.use('/api/buckets', require('./routes/buckets'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/patterns', require('./routes/patterns'));
app.use('/api/income', require('./routes/income'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Error handler
app.use(errorHandler);

// Start cron jobs
startJobs();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 VAULT Server running on port ${PORT}`));
// Triggering nodemon restart for new CORS origin

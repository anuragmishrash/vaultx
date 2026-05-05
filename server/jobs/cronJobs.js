const cron = require('node-cron');
const User = require('../models/User');
const Commitment = require('../models/Commitment');
const CommitmentLog = require('../models/CommitmentLog');
const { checkAndUpdateStreak } = require('../controllers/zeroDayController');
const { computeDNA } = require('../utils/dnaEngine');

const startJobs = () => {
  // Midnight: check zero days for all users
  cron.schedule('0 0 * * *', async () => {
    console.log('🕛 Running midnight zero-day check...');
    const users = await User.find({});
    for (const user of users) {
      try { await checkAndUpdateStreak(user._id); } catch (e) { console.error(e.message); }
    }
  });

  // Sunday 2 AM: recompute DNA for all users
  cron.schedule('0 2 * * 0', async () => {
    console.log('🧬 Running weekly DNA analysis...');
    const users = await User.find({});
    for (const user of users) {
      try { await computeDNA(user._id); } catch (e) { console.error(e.message); }
    }
  });

  // 1st of every month at 00:05 — auto-rollover commitment logs
  cron.schedule('5 0 1 * *', async () => {
    console.log('📋 [CommitmentBrain] Running monthly rollover...');
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const allActive = await Commitment.find({ isActive: true });
      let created = 0;
      for (const c of allActive) {
        const isPaused = c.pausedMonths?.some(p => p.month === month && p.year === year);
        if (isPaused) continue;
        await CommitmentLog.findOneAndUpdate(
          { commitmentId: c._id, userId: c.userId, month, year },
          {
            $setOnInsert: {
              commitmentId: c._id, userId: c.userId, month, year,
              isPaid: false, actualAmount: 0, paidOn: null,
              linkedTransactionId: null, variance: 0, note: '',
              autoRolledOver: true, createdAt: new Date(),
            },
          },
          { upsert: true, new: false }
        );
        created++;
      }
      console.log(`✅ [CommitmentBrain] Rollover complete — ${created} logs for ${month}/${year}`);
    } catch (err) {
      console.error('[CommitmentBrain] Rollover error:', err.message);
    }
  });

  console.log('✅ Cron jobs started');
};

module.exports = { startJobs };


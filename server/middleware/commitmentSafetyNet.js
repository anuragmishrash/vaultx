/**
 * commitmentSafetyNet.js
 * Feature 1: On-login safety net for monthly commitment rollover.
 * If the cron job missed running (server was down), this catches it.
 * Non-fatal — never blocks the request.
 */

const Commitment    = require('../models/Commitment');
const CommitmentLog = require('../models/CommitmentLog');
const CashEnvelope  = require('../models/CashEnvelope');
const User          = require('../models/User');

async function ensureMonthlyRollover(req, res, next) {
  try {
    if (!req.user) return next();
    const userId = req.user._id;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const commitmentCount = await Commitment.countDocuments({ userId, isActive: true });
    if (commitmentCount === 0) return next();

    const existingCount = await CommitmentLog.countDocuments({ userId, month, year });

    // Only roll over if no logs exist yet for this month
    if (existingCount === 0) {
      const commitments = await Commitment.find({ userId, isActive: true });
      for (const c of commitments) {
        const isPaused = c.pausedMonths?.some(p => p.month === month && p.year === year);
        if (isPaused) continue;

        await CommitmentLog.findOneAndUpdate(
          { commitmentId: c._id, userId, month, year },
          {
            $setOnInsert: {
              commitmentId: c._id,
              userId,
              month,
              year,
              isPaid: false,
              actualAmount: 0,
              paidOn: null,
              linkedTransactionId: null,
              variance: 0,
              note: '',
              autoRolledOver: true,
              createdAt: new Date(),
            },
          },
          { upsert: true, new: false }
        );
      }
    }
    // ── Cash envelope rollover ───────────────────────────────
    // If the user had an envelope last month but not this month, create a blank one
    // so the Cash Tracker page doesn't show empty / "Set up" state.
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastYear  = month === 1 ? year - 1 : year;
    const [hasCurrentEnv, lastEnv] = await Promise.all([
      CashEnvelope.countDocuments({ userId, month, year }),
      CashEnvelope.findOne({ userId, month: lastMonth, year: lastYear }),
    ]);
    if (lastEnv && hasCurrentEnv === 0) {
      const carriedBalance = lastEnv.currentBalance || 0;
      await CashEnvelope.create({
        userId, month, year,
        openingBalance: carriedBalance, 
        currentBalance: carriedBalance,
        totalWithdrawn: 0, 
        totalLogged: 0,
        untrackedAmount: 0,
      });
      console.log(`[SafetyNet] Carried over ₹${carriedBalance} to cash envelope for ${month}/${year}`);
    }

    // ── Pool carry-forward (back-stop if dashboard didn't do it) ─
    const user = await User.findById(userId).select('moneyMode spendingPool spendingPoolMonth spendingPoolYear');
    if (
      user?.moneyMode === 'pool' &&
      user?.spendingPool > 0 &&
      (user.spendingPoolMonth !== month || user.spendingPoolYear !== year)
    ) {
      await User.findByIdAndUpdate(userId, { spendingPoolMonth: month, spendingPoolYear: year });
    }
  } catch (err) {
    // Non-fatal — log and continue. Never block the request.
    console.error('[SafetyNet] Commitment rollover check failed:', err.message);
  }
  next();
}

module.exports = { ensureMonthlyRollover };

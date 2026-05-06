const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ZeroDayLog = require('../models/ZeroDayLog');
const CommitmentLog = require('../models/CommitmentLog');
const mongoose = require('mongoose');

/**
 * Determines if a specific calendar date was a zero day for a user.
 * Zero day = no regular transactions AND no commitment payments on that date.
 * Guilt-free spends and ATM withdrawals are excluded.
 * Paying rent/any commitment BREAKS your zero-day streak.
 */
async function isZeroDay(userId, date) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  // Count regular transactions (excluding ATM and guilt-free)
  const spendCount = await Transaction.countDocuments({
    userId:            userObjectId,
    date:              { $gte: start, $lte: end },
    isATMWithdrawal:   { $ne: true },
    isGuiltyFreeSpend: { $ne: true },
    // NOTE: isCommitmentPayment is NOT excluded here because auto-created
    // commitment transactions are already counted below via CommitmentLog,
    // and we want manual commitment-linked transactions to also count.
  });

  if (spendCount > 0) return false;

  // Also check CommitmentLog for any payment recorded on this date
  // (covers the case where commitments are paid via paidOn without a transaction)
  const commitmentPaidCount = await CommitmentLog.countDocuments({
    userId:  userObjectId,
    isPaid:  true,
    paidOn:  { $gte: start, $lte: end },
  });

  return commitmentPaidCount === 0;
}

/**
 * Gets zero day status for every day in a given month.
 * Returns an object keyed by date string "YYYY-MM-DD".
 */
async function getMonthZeroDays(userId, month, year) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const user = await User.findById(userObjectId).select('createdAt');
  const registrationDate = new Date(user.createdAt);
  registrationDate.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const result = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    // Future days — mark as null (unknown)
    if (date > today) {
      result[dateKey] = null;
      continue;
    }

    if (date < registrationDate) {
      // Before registration — not applicable
      result[dateKey] = 'pre_registration';
      continue;
    }

    const zeroDay = await isZeroDay(userObjectId, date);
    result[dateKey] = zeroDay;
  }

  return result;
}

/**
 * Calculates the current zero-day streak ending today.
 * Walks backwards from yesterday — today's streak only increments
 * at midnight once today becomes a confirmed zero day.
 */
async function calculateCurrentStreak(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const user = await User.findById(userObjectId).select('createdAt zeroDayPersonalBest');
  if (!user) return 0;

  const registrationDate = new Date(user.createdAt);
  registrationDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1); // start from yesterday

  // Walk backwards day by day until we hit a non-zero day or registration date
  while (checkDate >= registrationDate) {
    const zeroDay = await isZeroDay(userObjectId, checkDate);
    if (!zeroDay) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Also check if today has no spends yet — if so, include today in streak
  const todayIsZero = await isZeroDay(userObjectId, today);
  if (todayIsZero) streak++;

  return streak;
}

/**
 * Recalculates and saves the streak to the User document.
 * Call this after every transaction create/delete.
 */
async function refreshUserStreak(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const streak = await calculateCurrentStreak(userObjectId);

  // Also get personal best
  const user = await User.findById(userObjectId);
  const personalBest = Math.max(user.zeroDayPersonalBest || 0, streak);

  await User.findByIdAndUpdate(userObjectId, {
    zeroDayStreak: streak,
    zeroDayPersonalBest: personalBest,
    lastZeroDayCheck: new Date(),
  });

  return { streak, personalBest };
}

/**
 * Called after any transaction event.
 * Recalculates zero day for affected dates and refreshes streak.
 * @param {ObjectId} userId
 * @param {Date[]} affectedDates - 1 date normally, 2 if transaction date was changed
 */
async function invalidateAndRefresh(userId, affectedDates = []) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  for (const date of affectedDates) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    const isZero = await isZeroDay(userObjectId, d);

    // Update ZeroDayLog audit entry if it exists
    await ZeroDayLog.findOneAndUpdate(
      { userId: userObjectId, date: start },
      { $set: { wasZeroDay: isZero, recalculatedAt: new Date() } },
      { upsert: true }
    );
  }
  return await refreshUserStreak(userObjectId);
}

module.exports = {
  isZeroDay,
  getMonthZeroDays,
  calculateCurrentStreak,
  refreshUserStreak,
  invalidateAndRefresh
};

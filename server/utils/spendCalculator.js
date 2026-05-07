/**
 * spendCalculator.js
 * ──────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all spending / financial calculations.
 *
 * MENTAL MODEL:
 *   Account Balance = what you physically have RIGHT NOW.
 *   When Rent ₹6,500 was paid → account was auto-deducted → balance already
 *   dropped from ₹19,165 → ₹12,665. The ₹6,500 is GONE from the balance.
 *
 *   Safe to Spend = Balance − unpaid bills (future obligations not yet paid)
 *   DO NOT subtract paid bills again — they're already reflected in the balance.
 *
 *   Spent This Month = variable spend + bills ACTUALLY PAID this period
 *   Pool Remaining   = poolAmount × periodMultiplier − Spent This Month
 */

const mongoose  = require('mongoose');
const Transaction   = require('../models/Transaction');
const CommitmentLog = require('../models/CommitmentLog');
const Commitment    = require('../models/Commitment');

/**
 * Converts a "YYYY-MM-DD" string to local-timezone boundaries.
 * Avoids the UTC-day-boundary bug where May 6 IST appears as May 5 UTC.
 */
function localDayBounds(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end:   new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

/**
 * Returns start/end Date objects for a calendar month using LOCAL time.
 * No UTC offsets — safe for IST and any other timezone.
 */
function localMonthBounds(month, year) {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end:   new Date(year, month, 0, 23, 59, 59, 999),  // day 0 of next month = last day
  };
}

/**
 * Returns date range for a named period.
 * All dates use local-time boundaries (no UTC).
 */
function getPeriodBounds(period, now) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-based month

  switch (period) {
    case 'last_month': {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      return { ...localMonthBounds(lm, ly), months: 1, label: 'Last month' };
    }
    case '3_months':
      return {
        start:  new Date(y, m - 3, 1, 0, 0, 0, 0),
        end:    new Date(y, m, 0, 23, 59, 59, 999),
        months: 3,
        label:  'Last 3 months',
      };
    case 'all_time':
      return {
        start:  new Date(2020, 0, 1, 0, 0, 0, 0),
        end:    new Date(y, m, 0, 23, 59, 59, 999),
        months: null,   // caller must compute from createdAt
        label:  'All time',
      };
    default: // this_month
      return { ...localMonthBounds(m, y), months: 1, label: 'This month' };
  }
}

/**
 * Parses startDate/endDate query strings ("YYYY-MM-DD") into local Date objects.
 * Used by transactionController to avoid the UTC boundary bug.
 */
function parseDateParams(query) {
  const result = {};
  if (query.startDate) {
    const [sy, sm, sd] = query.startDate.split('-').map(Number);
    result.start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  }
  if (query.endDate) {
    const [ey, em, ed] = query.endDate.split('-').map(Number);
    result.end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  }
  return result;
}

/**
 * Gets the complete spending breakdown for a period.
 * This is the ONLY function that should calculate spending totals.
 *
 * @param {string|ObjectId} userId
 * @param {Date} startDate  — local-time start (midnight)
 * @param {Date} endDate    — local-time end (23:59:59.999)
 * @returns {Object} { variableTotal, billsPaidTotal, guiltyFreeTotal, totalMoneyOut, variableCount, billsPaidCount }
 */
async function getSpendingForPeriod(userId, startDate, endDate) {
  const uid = new mongoose.Types.ObjectId(userId.toString());

  // 1. Variable spending (regular transactions — not bills, not guilt-free, not ATM)
  const varResult = await Transaction.aggregate([
    {
      $match: {
        userId:              uid,
        date:                { $gte: startDate, $lte: endDate },
        isCommitmentPayment: { $ne: true },
        isGuiltyFreeSpend:   { $ne: true },
        isATMWithdrawal:     { $ne: true },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const variableTotal = varResult[0]?.total || 0;
  const variableCount = varResult[0]?.count || 0;

  // 2. Bills ACTUALLY PAID in this period (CommitmentLog.paidOn, not transaction date)
  //    This is critical — we use paidOn so the correct calendar date is used.
  const paidLogs = await CommitmentLog.find({
    userId:  uid,
    isPaid:  true,
    paidOn:  { $gte: startDate, $lte: endDate },
  });
  const billsPaidTotal = paidLogs.reduce((s, l) => s + (l.actualAmount || 0), 0);
  const billsPaidCount = paidLogs.length;

  // 3. Guilt-free spending (tracked separately, not in totalMoneyOut)
  const gfResult = await Transaction.aggregate([
    {
      $match: {
        userId:           uid,
        date:             { $gte: startDate, $lte: endDate },
        isGuiltyFreeSpend: true,
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const guiltyFreeTotal = gfResult[0]?.total || 0;

  // 4. Total money out = variable + bills paid
  //    (guilt-free shown separately; ATM is a transfer, not a spend)
  const totalMoneyOut = variableTotal + billsPaidTotal;

  return {
    variableTotal,
    variableCount,
    billsPaidTotal,
    billsPaidCount,
    guiltyFreeTotal,
    totalMoneyOut,
  };
}

/**
 * Gets unpaid commitments for a specific month/year.
 * Used for Safe to Spend calculation.
 * Safe to Spend = Account Balance − unpaid.total
 *
 * @param {string|ObjectId} userId
 * @param {number} month  1–12
 * @param {number} year   e.g. 2026
 */
async function getUnpaidCommitmentsForMonth(userId, month, year) {
  const uid = new mongoose.Types.ObjectId(userId.toString());

  const allCommitments = await Commitment.find({ userId: uid, isActive: true });
  const paidLogs = await CommitmentLog.find({
    userId: uid,
    month,
    year,
    isPaid: true,
  });
  const paidIds = new Set(paidLogs.map(l => l.commitmentId?.toString()));

  const unpaidItems = allCommitments.filter(c => !paidIds.has(c._id.toString()));
  const total = unpaidItems.reduce((s, c) => s + c.amount, 0);

  return { total, items: unpaidItems, count: unpaidItems.length };
}

/**
 * Computes the period-scaled pool amount for budget comparisons.
 * Prevents the "All Time shows 100% over budget" bug.
 *
 * @param {number} monthlyPool   — user's monthly pool/budget
 * @param {string} period        — 'this_month' | 'last_month' | '3_months' | 'all_time'
 * @param {number} monthsOfData  — months since account creation (for all_time)
 */
function getPeriodPool(monthlyPool, period, monthsOfData) {
  if (!monthlyPool || monthlyPool <= 0) return 0;
  switch (period) {
    case '3_months': return monthlyPool * 3;
    case 'all_time': return monthlyPool * Math.max(monthsOfData, 1);
    default:         return monthlyPool;  // this_month, last_month
  }
}

module.exports = {
  localDayBounds,
  localMonthBounds,
  getPeriodBounds,
  parseDateParams,
  getSpendingForPeriod,
  getUnpaidCommitmentsForMonth,
  getPeriodPool,
};

/**
 * brainEngine.js — Commitment Brain intelligence layer
 * All 7 features live here as pure utility functions.
 */

const CommitmentLog = require('../models/CommitmentLog');
const Commitment = require('../models/Commitment');
const Transaction = require('../models/Transaction');

// ─────────────────────────────────────────────────────────
// FEATURE 2: Smart Amount Prediction for flexible bills
// ─────────────────────────────────────────────────────────

/**
 * Predicts the expected amount for a flexible commitment
 * using a weighted average of the last 6 months of paid logs.
 * More recent months receive higher weight.
 */
async function predictFlexibleAmount(commitmentId) {
  const logs = await CommitmentLog.find({
    commitmentId,
    isPaid: true,
    actualAmount: { $gt: 0 },
  })
    .sort({ year: -1, month: -1 })
    .limit(6)
    .lean();

  if (logs.length === 0) return null;
  if (logs.length === 1) {
    return { predicted: logs[0].actualAmount, confidence: 'low', trend: 'unknown', trendPct: 0, history: logs };
  }

  // Weighted average: most recent = weight N, oldest = weight 1
  const totalWeight = logs.reduce((sum, _, i) => sum + (logs.length - i), 0);
  const weightedSum = logs.reduce((sum, log, i) => sum + log.actualAmount * (logs.length - i), 0);
  const predicted = Math.round(weightedSum / totalWeight);

  // Trend: recent 2 months vs older months
  const recent = logs.slice(0, 2).reduce((s, l) => s + l.actualAmount, 0) / Math.min(2, logs.length);
  const olderSlice = logs.slice(2);
  const older = olderSlice.length > 0
    ? olderSlice.reduce((s, l) => s + l.actualAmount, 0) / olderSlice.length
    : recent;

  const trendPct = older > 0 ? Math.round(((recent - older) / older) * 100) : 0;
  const trend = trendPct > 8 ? 'rising' : trendPct < -8 ? 'falling' : 'stable';
  const confidence = logs.length >= 4 ? 'high' : 'medium';

  return { predicted, confidence, trend, trendPct, history: logs };
}

// ─────────────────────────────────────────────────────────
// FEATURE 3: Auto Transaction Matching
// ─────────────────────────────────────────────────────────

/**
 * After a transaction is saved, find the best-matching unpaid commitment.
 * Returns best match object or null if score < threshold.
 */
async function findMatchingCommitment(transaction, userId) {
  const txDate = new Date(transaction.date);
  const month = txDate.getMonth() + 1;
  const year = txDate.getFullYear();

  const unpaidLogs = await CommitmentLog.find({ userId, month, year, isPaid: false })
    .populate('commitmentId')
    .lean();

  if (unpaidLogs.length === 0) return null;

  const txTitle = (transaction.title || '').toLowerCase().trim();
  const txAmount = transaction.amount;

  let bestMatch = null;
  let bestScore = 0;

  for (const log of unpaidLogs) {
    const c = log.commitmentId;
    if (!c || !c.isActive) continue;

    let score = 0;
    const cTitle = (c.title || '').toLowerCase().trim();

    // Title similarity
    if (txTitle === cTitle) score += 60;
    else if (txTitle.includes(cTitle) || cTitle.includes(txTitle)) score += 40;
    else {
      const txWords = txTitle.split(/\s+/);
      const cWords = cTitle.split(/\s+/);
      const overlap = txWords.filter(
        w => w.length > 2 && cWords.some(cw => cw.includes(w) || w.includes(cw))
      );
      score += overlap.length * 15;
    }

    // Amount similarity
    if (txAmount === c.amount) score += 40;
    else if (c.isFlexible && c.flexibleRange && txAmount >= c.flexibleRange.min && txAmount <= c.flexibleRange.max) score += 30;
    else {
      const diff = c.amount > 0 ? Math.abs(txAmount - c.amount) / c.amount : 1;
      if (diff < 0.05) score += 25;
      else if (diff < 0.15) score += 10;
    }

    // Category bonus
    const catMap = {
      Housing: ['Housing', 'Others'],
      Utilities: ['Utilities'],
      'Health & Fitness': ['Health & Fitness'],
      Transport: ['Transport'],
    };
    if (c.category && transaction.category && catMap[c.category]?.includes(transaction.category)) {
      score += 10;
    }

    if (score > bestScore && score >= 45) {
      bestScore = score;
      bestMatch = { commitment: c, log, score };
    }
  }

  return bestMatch;
}

// ─────────────────────────────────────────────────────────
// FEATURE 4: Smart Commitment Suggestions from History
// ─────────────────────────────────────────────────────────

/**
 * Scans the last 90 days of transactions for recurring monthly patterns
 * that the user hasn't already added as commitments.
 */
async function detectUnaddedCommitments(userId) {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const transactions = await Transaction.find({
    userId,
    date: { $gte: since },
    isGuiltyFreeSpend: false,
  }).lean();

  // Group by normalized title
  const groups = {};
  for (const t of transactions) {
    const key = (t.title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const recurring = [];
  for (const [, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;
    const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Check for monthly pattern (25–40 days apart)
    let isMonthly = false;
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 25 && daysDiff <= 40) { isMonthly = true; break; }
    }
    if (!isMonthly) continue;

    const amounts = txns.map(t => t.amount);
    const avgAmount = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const isVariable = !amounts.every(a => Math.abs(a - avgAmount) / (avgAmount || 1) < 0.2);

    recurring.push({
      title: txns[0].title,
      avgAmount,
      isVariable,
      category: txns[0].category,
      occurrences: txns.length,
      lastSeen: sorted[sorted.length - 1].date,
    });
  }

  // Filter out already-tracked commitments
  const existing = await Commitment.find({ userId, isActive: true }).lean();
  const existingTitles = existing.map(c => (c.title || '').toLowerCase().trim());

  return recurring.filter(r =>
    !existingTitles.some(t => t.includes(r.title.toLowerCase()) || r.title.toLowerCase().includes(t))
  );
}

// ─────────────────────────────────────────────────────────
// FEATURE 7: Year-over-Year Drift Detection
// ─────────────────────────────────────────────────────────

/**
 * Compares this month's paid amount vs same month last year.
 * Returns drift info if > 10% change, otherwise null.
 */
async function detectYoYDrift(commitmentId) {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;

  const [thisLog, lastLog] = await Promise.all([
    CommitmentLog.findOne({ commitmentId, month: thisMonth, year: thisYear, isPaid: true }).lean(),
    CommitmentLog.findOne({ commitmentId, month: thisMonth, year: lastYear, isPaid: true }).lean(),
  ]);

  if (!thisLog?.actualAmount || !lastLog?.actualAmount) return null;

  const drift = ((thisLog.actualAmount - lastLog.actualAmount) / lastLog.actualAmount) * 100;
  if (Math.abs(drift) < 10) return null;

  return {
    driftPct: Math.round(drift),
    thisAmount: thisLog.actualAmount,
    lastAmount: lastLog.actualAmount,
    direction: drift > 0 ? 'up' : 'down',
    label: drift > 0
      ? `${Math.round(drift)}% more than ${thisMonth}/${lastYear}`
      : `${Math.abs(Math.round(drift))}% less than ${thisMonth}/${lastYear}`,
  };
}

module.exports = {
  predictFlexibleAmount,
  findMatchingCommitment,
  detectUnaddedCommitments,
  detectYoYDrift,
};

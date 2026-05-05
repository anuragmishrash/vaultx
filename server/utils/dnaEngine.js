const Transaction = require('../models/Transaction');
const User = require('../models/User');
const SpendDNA = require('../models/SpendDNA');
const mongoose = require('mongoose');

const DNA_CATEGORIES = {
  comfort: ['Food & Dining', 'Personal Care', 'Utilities'],
  experience: ['Travel', 'Entertainment', 'Education'],
  impulse: ['Shopping', 'Others'],
  discipline: ['Investments', 'Health & Fitness'],
};

const MINIMUM_TRANSACTIONS = 10;
const MINIMUM_DAYS_ACTIVE = 7;
const MINIMUM_CATEGORIES = 2;

/**
 * Check if user has enough data and compute scores WITHOUT saving.
 * Used by getDNA to show progress without creating snapshots.
 */
const checkDNA = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const transactions = await Transaction.find({
    userId: userObjectId,
    date: { $gte: threeMonthsAgo },
  });

  const uniqueDays = new Set(transactions.map(t => new Date(t.date).toDateString())).size;
  const uniqueCategories = new Set(transactions.map(t => t.category).filter(Boolean)).size;

  const progress = {
    transactions: { current: transactions.length, needed: MINIMUM_TRANSACTIONS },
    days: { current: uniqueDays, needed: MINIMUM_DAYS_ACTIVE },
    categories: { current: uniqueCategories, needed: MINIMUM_CATEGORIES },
  };

  if (
    transactions.length < MINIMUM_TRANSACTIONS ||
    uniqueDays < MINIMUM_DAYS_ACTIVE ||
    uniqueCategories < MINIMUM_CATEGORIES
  ) {
    const reason = transactions.length < MINIMUM_TRANSACTIONS
      ? `Need at least ${MINIMUM_TRANSACTIONS} transactions (you have ${transactions.length}).`
      : uniqueCategories < MINIMUM_CATEGORIES
      ? `Need spending in at least ${MINIMUM_CATEGORIES} categories to detect a pattern`
      : `Need transactions spread across at least ${MINIMUM_DAYS_ACTIVE} days`;

    return { canCompute: false, reason, progress };
  }

  return { canCompute: true, progress };
};

/**
 * Full computation + save. Only call this from the recompute button.
 */
const computeDNA = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const transactions = await Transaction.find({
    userId: userObjectId,
    date: { $gte: threeMonthsAgo },
  });

  const uniqueDays = new Set(transactions.map(t => new Date(t.date).toDateString())).size;
  const uniqueCategories = new Set(transactions.map(t => t.category).filter(Boolean)).size;

  const progress = {
    transactions: { current: transactions.length, needed: MINIMUM_TRANSACTIONS },
    days: { current: uniqueDays, needed: MINIMUM_DAYS_ACTIVE },
    categories: { current: uniqueCategories, needed: MINIMUM_CATEGORIES },
  };

  if (
    transactions.length < MINIMUM_TRANSACTIONS ||
    uniqueDays < MINIMUM_DAYS_ACTIVE ||
    uniqueCategories < MINIMUM_CATEGORIES
  ) {
    const reason = transactions.length < MINIMUM_TRANSACTIONS
      ? `Need at least ${MINIMUM_TRANSACTIONS} transactions (you have ${transactions.length}).`
      : uniqueCategories < MINIMUM_CATEGORIES
      ? `Need spending in at least ${MINIMUM_CATEGORIES} categories to detect a pattern`
      : `Need transactions spread across at least ${MINIMUM_DAYS_ACTIVE} days`;

    return { canCompute: false, reason, progress, scores: null, dominantType: null };
  }

  // Sufficient data — compute DNA scores
  const totals = { comfort: 0, experience: 0, impulse: 0, discipline: 0 };
  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);

  transactions.forEach(t => {
    for (const [dna, cats] of Object.entries(DNA_CATEGORIES)) {
      if (cats.includes(t.category)) {
        totals[dna] += t.amount;
      }
    }
  });

  const scores = {};
  for (const key of Object.keys(totals)) {
    scores[key] = totalSpent > 0 ? Math.round((totals[key] / totalSpent) * 100) : 0;
  }

  // Boost discipline score based on regret rates
  const regretTxns = transactions.filter(t => t.regretStatus === 'regret').length;
  const ratedTxns = transactions.filter(t => t.regretStatus !== 'pending').length;
  const regretRate = ratedTxns > 0 ? regretTxns / ratedTxns : 0;

  if (regretRate < 0.2) scores.discipline = Math.min(100, scores.discipline + 20);
  if (regretRate > 0.5) scores.impulse = Math.min(100, scores.impulse + 20);

  const types = ['Comfort Spender', 'Experience Chaser', 'Impulse Buyer', 'Disciplined Saver'];
  const keys = ['comfort', 'experience', 'impulse', 'discipline'];
  const maxKey = keys.reduce((a, b) => scores[a] > scores[b] ? a : b);
  const dominantType = types[keys.indexOf(maxKey)];

  // Save snapshot
  await SpendDNA.create({
    userId, snapshot: scores, dominantType,
    meetsMinimum: true,
    transactionCount: transactions.length,
    daysActive: uniqueDays,
    categoriesUsed: uniqueCategories,
  });
  await User.findByIdAndUpdate(userId, { spendDNAType: dominantType, spendDNALastUpdated: new Date() });

  return { canCompute: true, scores, dominantType, progress };
};

module.exports = { computeDNA, checkDNA };

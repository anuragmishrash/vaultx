const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const TransactionPattern = require('../models/TransactionPattern');

const MIN_OCCURRENCES_FOR_DAILY = 3;
const MIN_OCCURRENCES_FOR_WEEKLY = 2;
const MIN_OCCURRENCES_FOR_MONTHLY = 2;

async function analyzeAndUpdatePatterns(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const transactions = await Transaction.find({
    userId: userObjectId,
    date: { $gte: since },
  }).lean();

  const groups = {};
  for (const t of transactions) {
    const key = (t.normalizedTitle || t.title.toLowerCase().trim()).replace(/\s+/g, ' ');
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  for (const [normalizedTitle, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;

    const sorted = txns.sort((a, b) => new Date(a.date) - new Date(b.date));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].date) - new Date(sorted[i-1].date)) / (1000*60*60*24);
      gaps.push(days);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency;
    if (avgGap <= 1.5)       frequency = 'daily';
    else if (avgGap <= 3.5)  frequency = 'alternate_days';
    else if (avgGap <= 10)   frequency = 'weekly';
    else if (avgGap <= 35)   frequency = 'monthly';
    else                     frequency = 'custom';

    const minOccurrences =
      frequency === 'daily'         ? MIN_OCCURRENCES_FOR_DAILY   :
      frequency === 'alternate_days'? MIN_OCCURRENCES_FOR_DAILY   :
      frequency === 'weekly'        ? MIN_OCCURRENCES_FOR_WEEKLY  :
      MIN_OCCURRENCES_FOR_MONTHLY;

    if (txns.length < minOccurrences) continue;

    const amounts = sorted.map(t => t.amount);
    const avgAmount = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);

    let confidence = 50 + (txns.length * 5);
    if (confidence > 100) confidence = 100;

    const lastDate = new Date(sorted[sorted.length - 1].date);
    const nextExpectedDate = new Date(lastDate.getTime() + (avgGap * 24 * 60 * 60 * 1000));

    const guiltFreeCount = sorted.filter(t => t.isGuiltyFreeSpend === true).length;
    const isGuiltyFree = guiltFreeCount / sorted.length > 0.5;
    const isCommitmentLinked = sorted.some(t => t.isCommitmentPayment === true);
    const isMonthlyBill = frequency === 'monthly' && avgGap >= 25;

    let suggestionType;
    if (isCommitmentLinked || isMonthlyBill) {
      suggestionType = 'commitment';
    } else if (isGuiltyFree) {
      suggestionType = 'guilt_free';
    } else {
      suggestionType = 'transaction';
    }

    await TransactionPattern.findOneAndUpdate(
      { userId: userObjectId, normalizedTitle },
      {
        $set: {
          title: sorted[0].title,
          amount: avgAmount,
          category: sorted[0].category,
          paymentMode: sorted[0].paymentMode,
          frequency,
          confidence,
          occurrences: txns.length,
          nextExpectedDate,
          suggestionType,
        }
      },
      { upsert: true, new: true }
    );
  }
}

function getDateBounds() {
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0,0,0,0);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
  return { today, yesterday, todayStart, todayEnd };
}

function getSuggestionMessage(p) {
  if (p.frequency === 'daily') return 'Daily purchase';
  if (p.frequency === 'weekly') return 'Weekly purchase';
  return 'Regular purchase';
}

async function filterAlreadyAdded(patterns, userObjectId, todayStart, todayEnd) {
  const result = [];
  for (const p of patterns) {
    if (p.suggestionDismissedCount >= 5) continue;
    const alreadyAdded = await Transaction.countDocuments({
      userId: userObjectId,
      normalizedTitle: p.normalizedTitle,
      date: { $gte: todayStart, $lte: todayEnd },
    });
    if (alreadyAdded > 0) continue;
    result.push({
      patternId: p._id,
      title: p.title,
      amount: p.amount,
      category: p.category,
      paymentMode: p.paymentMode,
      frequency: p.frequency,
      confidence: p.confidence,
      message: getSuggestionMessage(p),
    });
  }
  return result;
}

async function getTransactionSuggestions(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const { today, yesterday, todayStart, todayEnd } = getDateBounds();

  const patterns = await TransactionPattern.find({
    userId: userObjectId,
    isActive: true,
    suggestionType: 'transaction',
    confidence: { $gte: 55 },
    occurrences: { $gte: 3 },
    frequency: { $in: ['daily', 'alternate_days', 'weekly'] },
    nextExpectedDate: { $lte: today, $gte: yesterday },
  }).sort({ confidence: -1 }).lean();

  return await filterAlreadyAdded(patterns, userObjectId, todayStart, todayEnd);
}

async function getGuiltFreeSuggestions(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const { today, yesterday, todayStart, todayEnd } = getDateBounds();

  const patterns = await TransactionPattern.find({
    userId: userObjectId,
    isActive: true,
    suggestionType: 'guilt_free',
    confidence: { $gte: 45 },
    occurrences: { $gte: 2 },
    nextExpectedDate: { $lte: today, $gte: yesterday },
  }).sort({ confidence: -1 }).lean();

  return await filterAlreadyAdded(patterns, userObjectId, todayStart, todayEnd);
}

async function getCommitmentSuggestions(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const now = new Date();

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const patterns = await TransactionPattern.find({
    userId: userObjectId,
    isActive: true,
    suggestionType: 'commitment',
    confidence: { $gte: 45 },
    occurrences: { $gte: 2 },
    nextExpectedDate: { $gte: now, $lte: sevenDaysFromNow },
  }).sort({ nextExpectedDate: 1 }).lean();

  return patterns
    .filter(p => p.suggestionDismissedCount < 5)
    .map(p => {
      const daysUntilDue = Math.ceil(
        (new Date(p.nextExpectedDate) - now) / (1000 * 60 * 60 * 24)
      );
      return {
        patternId: p._id,
        title: p.title,
        amount: p.amount,
        category: p.category,
        paymentMode: p.paymentMode,
        nextExpectedDate: p.nextExpectedDate,
        daysUntilDue,
        message: daysUntilDue <= 0
          ? `${p.title} due today`
          : daysUntilDue === 1
          ? `${p.title} due tomorrow`
          : `${p.title} due in ${daysUntilDue} days`,
        isUrgent: daysUntilDue <= 2,
      };
    });
}

module.exports = {
  analyzeAndUpdatePatterns,
  getTransactionSuggestions,
  getGuiltFreeSuggestions,
  getCommitmentSuggestions
};

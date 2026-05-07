const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Commitment = require('../models/Commitment');
const CommitmentLog = require('../models/CommitmentLog');

const computeWaterfall = async (userId, month, year) => {
  const user = await User.findById(userId);
  const income = user.moneyMode === 'pool' && user.spendingPool > 0 
    ? user.spendingPool 
    : user.monthlySalary || 0;

  const commitments = await Commitment.find({ userId, isActive: true });

  // Filter out paused commitments for this month
  const activeCommitments = commitments.filter(c => {
    const isPaused = c.pausedMonths.some(pm => pm.month === month && pm.year === year);
    return !isPaused;
  });

  const logs = await CommitmentLog.find({ userId, month, year });

  const totalCommitments = activeCommitments.reduce((sum, c) => {
    const log = logs.find(l => l.commitmentId.toString() === c._id.toString());
    if (log && log.isPaid) return sum + (log.actualAmount || c.amount);
    return sum + c.amount;
  }, 0);

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const allTransactions = await Transaction.find({
    userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const commitmentTitles = activeCommitments.map(c => c.title.toLowerCase());

  const guiltyFreeTransactions = allTransactions.filter(t => t.isGuiltyFreeSpend);
  const guiltyFreeUsed = guiltyFreeTransactions.reduce((s, t) => s + t.amount, 0);

  const variableTransactions = allTransactions.filter(t =>
    !t.isGuiltyFreeSpend &&
    !t.isCommitmentPayment &&
    !t.isATMWithdrawal
  );
  const variableSpending = variableTransactions.reduce((s, t) => s + t.amount, 0);

  const trueFreeMonney = income - totalCommitments - variableSpending;
  const investableSurplus = trueFreeMonney - guiltyFreeUsed;

  // Health score computation
  let healthScore = 100;
  const commitmentRatio = income > 0 ? totalCommitments / income : 0;
  
  if (income > 0) {
    if (commitmentRatio > 0.70) healthScore -= 15;
    else if (commitmentRatio > 0.50) healthScore -= 5;
  }

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const overdueCommitments = [];
  let missedCount = 0;
  
  if (month === currentMonth && year === currentYear) {
    activeCommitments.forEach(c => {
      const log = logs.find(l => l.commitmentId.toString() === c._id.toString());
      if (!log?.isPaid && todayDay > c.dueDay) {
        overdueCommitments.push(c);
        missedCount++;
      }
    });
  }

  if (missedCount > 0) {
    healthScore -= (missedCount * 20); // -20 per missed payment
  }

  const paidCount = logs.filter(l => l.isPaid).length;
  if (paidCount === activeCommitments.length && activeCommitments.length > 0) {
    healthScore = Math.min(100, healthScore + 10);
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    income,
    totalCommitments,
    committedBalance: income - totalCommitments,
    variableSpending,
    trueFreeMonney,
    guiltyFreeUsed,
    investableSurplus,
    commitmentsPaidCount: paidCount,
    commitmentsTotal: activeCommitments.length,
    healthScore,
    overdueCommitments: overdueCommitments.map(c => ({ id: c._id, title: c.title, dueDay: c.dueDay })),
    commitmentRatio: Math.round(commitmentRatio * 100),
  };
};

module.exports = { computeWaterfall };

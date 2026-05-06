const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getEffectiveBudget } = require('../utils/budgetHelpers');
const { calculateCurrentStreak } = require('../utils/zeroDayEngine');

const getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const user  = req.user;
    const dayOfMonth   = now.getDate();
    const daysInMonth  = end.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    // Exclude future-dated transactions from spending totals
    const txns = await Transaction.find({
      userId: user._id,
      date:   { $gte: start, $lte: today },
    });
    // ATM withdrawals are cash transfers, not actual spending
    const spendTxns = txns.filter(t => !t.isATMWithdrawal);
    const totalSpent = spendTxns.reduce((s, t) => s + t.amount, 0);

    // Effective budget
    const effectiveBudget = getEffectiveBudget(user);
    const budget = effectiveBudget.amount;
    const budgetRemaining = budget ? budget - totalSpent : null;

    const rated       = spendTxns.filter(t => t.regretStatus !== 'pending');
    const regretCount = rated.filter(t => t.regretStatus === 'regret').length;
    const regretScore = rated.length > 0 ? Math.round((regretCount / rated.length) * 100) : 0;

    // Regret breakdown
    const regretBreakdown = {
      regret:   { count: 0, total: 0 },
      okay:     { count: 0, total: 0 },
      worth_it: { count: 0, total: 0 },
      rated: rated.length,
      total: spendTxns.length,
    };
    rated.forEach(t => {
      if (regretBreakdown[t.regretStatus]) {
        regretBreakdown[t.regretStatus].count++;
        regretBreakdown[t.regretStatus].total += t.amount;
      }
    });

    // Category breakdown
    const categoryMap = {};
    txns.forEach(t => { categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount; });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Daily spending
    const dailyMap = {};
    txns.forEach(t => {
      const day = new Date(t.date).getDate();
      dailyMap[day] = (dailyMap[day] || 0) + t.amount;
    });
    const todayDay = now.getDate();
    const dailySpend = [];
    let cumulative = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= todayDay) {
        cumulative += dailyMap[d] || 0;
        dailySpend.push({ day: d, amount: dailyMap[d] || 0, cumulative });
      } else {
        dailySpend.push({ day: d, amount: null, cumulative: null });
      }
    }

    // Smart forecast
    let forecastTotal = 0;
    let forecastConfidence = 'high';
    let forecastMessage = null;

    if (dayOfMonth === 1) {
      forecastTotal = null;
      forecastConfidence = 'none';
      forecastMessage = 'new_month';
    } else if (dayOfMonth < 5) {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
      const lmStart   = new Date(lastYear, lastMonth - 1, 1);
      const lmEnd     = new Date(lastYear, lastMonth, 0, 23, 59, 59);
      const lmTxns    = await Transaction.find({ userId: user._id, date: { $gte: lmStart, $lte: lmEnd } });
      const lmTotal   = lmTxns.reduce((s, t) => s + t.amount, 0);
      const lmDays    = new Date(lastYear, lastMonth, 0).getDate();
      const lmDailyAvg = lmTotal / lmDays;
      const curDailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
      const blendWeight = dayOfMonth / 5;
      const blendedAvg = (curDailyAvg * blendWeight) + (lmDailyAvg * (1 - blendWeight));
      forecastTotal      = Math.round(totalSpent + (blendedAvg * (daysInMonth - dayOfMonth)));
      forecastConfidence = 'low';
      forecastMessage    = 'early_estimate';
    } else {
      const avgPerDay = totalSpent / dayOfMonth;
      forecastTotal   = Math.round(avgPerDay * daysInMonth);
      forecastConfidence = dayOfMonth >= 15 ? 'high' : 'medium';
    }

    // Pending regret
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const pendingRegret = await Transaction.find({
      userId: user._id,
      regretStatus: 'pending',
      date: { $lte: yesterday },
      isGuiltyFreeSpend: { $ne: true },
    }).limit(5);

    const streak = await calculateCurrentStreak(user._id);
    if (streak !== user.zeroDayStreak) {
      await User.findByIdAndUpdate(user._id, { zeroDayStreak: streak });
    }

    // ── Account-based Safe to Spend ─────────────────────────────────────────
    const Account = require('../models/Account');
    const Commitment = require('../models/Commitment');
    const CommitmentLog = require('../models/CommitmentLog');

    const accounts = await Account.find({ userId: user._id, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const hasAccounts = accounts.length > 0;

    // Unpaid commitments this month
    const allCommitments = await Commitment.find({ userId: user._id, isActive: true });
    const paidLogs = await CommitmentLog.find({
      userId: user._id,
      month: currentMonth, year: currentYear, isPaid: true,
    });
    const paidIds = new Set(paidLogs.map(l => l.commitmentId?.toString()));
    const unpaidCommitments = allCommitments
      .filter(c => !paidIds.has(c._id.toString()))
      .reduce((s, c) => s + c.amount, 0);

    const safeToSpend = totalBalance - unpaidCommitments;

    res.json({
      success: true,
      kpi: {
        totalSpent,
        budgetRemaining,
        regretScore,
        zeroDayStreak: streak,
        budget,
        budgetSource: effectiveBudget.source,
        budgetLabel: effectiveBudget.label,
        isOverBudget: budget ? totalSpent > budget : false,
        budgetPercent: budget ? Math.min(Math.round((totalSpent / budget) * 100), 100) : null,
      },
      categoryBreakdown,
      dailySpend,
      forecast: {
        forecastTotal,
        budget,
        budgetLabel: effectiveBudget.label,
        overshoot: (forecastTotal && budget) ? forecastTotal - budget : 0,
        confidence: forecastConfidence,
        message: forecastMessage,
        dayOfMonth,
      },
      pendingRegret: pendingRegret.map(t => ({ id: t._id, title: t.title, amount: t.amount, date: t.date, category: t.category })),
      recentTransactions: txns.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
      regretBreakdown,
      // Account-based fields
      totalBalance,
      safeToSpend,
      unpaidCommitments,
      hasAccounts,
      accounts: accounts.map(a => ({
        _id:       a._id,
        name:      a.name,
        type:      a.type,
        balance:   a.balance,
        isDefault: a.isDefault,
        color:     a.color,
      })),
    });
  } catch (err) { next(err); }
};


const getMonthly = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txns = await Transaction.find({ userId: req.user._id, date: { $gte: start, $lte: end } });
      const total = txns.reduce((s, t) => s + t.amount, 0);
      result.push({ month: start.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), total });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getDayOfWeek = async (req, res, next) => {
  try {
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() - 3);
    const txns = await Transaction.find({ userId: req.user._id, date: { $gte: threeMonths } });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
    txns.forEach(t => {
      const day = days[new Date(t.date).getDay()];
      dayMap[day].push(t.amount);
    });
    const result = days.map(d => ({
      day: d,
      avg: dayMap[d].length > 0 ? Math.round(dayMap[d].reduce((s, a) => s + a, 0) / dayMap[d].length) : 0
    }));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getFutureValue = async (req, res, next) => {
  try {
    const { amount, rate = 12, years = 5 } = req.query;
    const pv = parseFloat(amount) || 0;
    const r = parseFloat(rate) / 100;
    const n = parseFloat(years);
    const fv = pv * Math.pow(1 + r, n);
    res.json({ success: true, presentValue: pv, futureValue: Math.round(fv), rate, years });
  } catch (err) { next(err); }
};

const getForecast = async (req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txns = await Transaction.find({ userId: req.user._id, date: { $gte: start } });
    const totalSpent = txns.reduce((s, t) => s + t.amount, 0);
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const avgPerDay = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const forecast = Math.round(avgPerDay * daysInMonth);
    const effectiveBudget = getEffectiveBudget(req.user);
    res.json({ success: true, totalSpent, forecast, daysElapsed, daysInMonth, budget: effectiveBudget.amount, budgetLabel: effectiveBudget.label });
  } catch (err) { next(err); }
};

const getCategoryTrends = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txns = await Transaction.find({ userId: req.user._id, date: { $gte: start, $lte: end } });
      const entry = { month: start.toLocaleString('default', { month: 'short' }) };
      txns.forEach(t => { entry[t.category] = (entry[t.category] || 0) + t.amount; });
      result.push(entry);
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
const getPaidCommitmentsTotal = async (userId, period, startDate, endDate, numberOfMonths) => {
  const Commitment = require('../models/Commitment');
  const CommitmentLog = require('../models/CommitmentLog');

  if (period === 'this_month') {
    // Only count ACTUAL PAYMENT RECORDS for This Month
    const targetMonth = startDate.getMonth() + 1;
    const targetYear = startDate.getFullYear();
    const logs = await CommitmentLog.find({
      userId,
      isPaid: true,
      month: targetMonth,
      year: targetYear
    });
    return logs.reduce((sum, log) => sum + (log.actualAmount || 0), 0);
  }

  const commitments = await Commitment.find({ userId, isActive: true });
  
  let total = 0;
  
  commitments.forEach(c => {
    // Determine the monthly contribution
    const freq = (c.frequency || 'monthly').toLowerCase();
    let monthlyContribution = 0;
    
    if (freq === 'monthly') {
      monthlyContribution = c.amount;
    } else if (freq === 'yearly' || freq === 'annual') {
      monthlyContribution = c.amount / 12;
    } else if (freq === 'weekly') {
      monthlyContribution = c.amount * 4.33;
    } else if (freq === 'quarterly') {
      monthlyContribution = c.amount / 3;
    } else if (freq === 'one-time' || freq === 'once') {
      monthlyContribution = c.amount / numberOfMonths; 
    } else {
      monthlyContribution = c.amount;
    }
    
    total += monthlyContribution * numberOfMonths;
  });
  
  return total;
};

const getVariableSpend = async (userId, period, startDate, endDate) => {
  const Transaction = require('../models/Transaction');
  const txQuery = {
    userId,
    paymentMode: { $ne: 'Cash' },
    isATMWithdrawal: { $ne: true }
  };
  if (period !== 'all_time') {
    txQuery.date = { $gte: startDate, $lte: endDate };
  }
  const txns = await Transaction.find(txQuery);
  return txns.reduce((sum, t) => sum + t.amount, 0);
};

const getTfm = async (req, res, next) => {
  try {
    const { period } = req.query; // 'this_month', 'last_month', '3_months', 'all_time'
    const Account     = require('../models/Account');
    const Commitment  = require('../models/Commitment');
    const CommitmentLog = require('../models/CommitmentLog');

    const now = new Date();
    let startDate, endDate, numberOfMonths;

    if (period === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      numberOfMonths = 1;
    } else if (period === '3_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      numberOfMonths = 3;
    } else if (period === 'all_time') {
      const user = await User.findById(req.user._id);
      startDate = user.createdAt || new Date(now.getFullYear() - 1, now.getMonth(), 1);
      endDate   = null;
      const diffDays = Math.ceil(Math.abs(new Date() - startDate) / (1000 * 60 * 60 * 24));
      numberOfMonths = Math.max(1, Math.round(diffDays / 30));
    } else {
      // this_month (default)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      numberOfMonths = 1;
    }

    // ── New formula: Total Account Balance − Unpaid Commitments ────────────
    const accounts = await Account.find({ userId: req.user._id, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const hasAccounts  = accounts.length > 0;

    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    const allCommitments = await Commitment.find({ userId: req.user._id, isActive: true });
    const paidLogs = await CommitmentLog.find({
      userId: req.user._id,
      month: currentMonth, year: currentYear, isPaid: true,
    });
    const paidIds = new Set(paidLogs.map(l => l.commitmentId?.toString()));
    const unpaidTotal = allCommitments
      .filter(c => !paidIds.has(c._id.toString()))
      .reduce((s, c) => s + c.amount, 0);

    const commitmentsTotal = await getPaidCommitmentsTotal(req.user._id, period, startDate, endDate, numberOfMonths);
    const variableSpend    = await getVariableSpend(req.user._id, period, startDate, endDate);

    // Safe to Spend = total balance − unpaid commitments
    const safeToSpend   = totalBalance - unpaidTotal;
    // True Free Money = Safe to Spend − variable spending in selected period
    const trueFreeMoney = safeToSpend - variableSpend;

    res.json({
      success: true,
      // Account-based fields (new)
      totalBalance,
      hasAccounts,
      safeToSpend,
      unpaidCommitments: unpaidTotal,
      // Period-specific breakdowns
      commitmentsTotal,
      variableSpend,
      trueFreeMoney,
      period,
      numberOfMonths,
      // Legacy fields kept for backwards compat with any frontend references
      pool: totalBalance,
      actualIncome: null,
      isCarryForward: false,
      carryForwardAmount: 0,
    });
  } catch (err) { next(err); }
};

module.exports = { getDashboard, getMonthly, getDayOfWeek, getFutureValue, getForecast, getCategoryTrends, getTfm };

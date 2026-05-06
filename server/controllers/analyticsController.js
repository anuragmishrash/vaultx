const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getEffectiveBudget } = require('../utils/budgetHelpers');
const { calculateCurrentStreak } = require('../utils/zeroDayEngine');

// ─── Lazy-load models that are only needed here ──────────────────────────────
const getAccountModels = () => ({
  Account:       require('../models/Account'),
  Commitment:    require('../models/Commitment'),
  CommitmentLog: require('../models/CommitmentLog'),
});

// ─── Helper: date range from period ──────────────────────────────────────────
function getPeriodRange(period, now) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: new Date(ly, lm, 1), end: new Date(ly, lm + 1, 0, 23, 59, 59, 999), months: 1, label: 'Last month' };
    }
    case '3_months':
      return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999), months: 3, label: 'Last 3 months' };
    case 'all_time':
      return { start: new Date('2020-01-01'), end: new Date(y, m + 1, 0, 23, 59, 59, 999), months: null, label: 'All time' };
    default: // this_month
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999), months: 1, label: 'This month' };
  }
}

const getDashboard = async (req, res, next) => {
  try {
    const now    = new Date();
    const today  = new Date(); today.setHours(23, 59, 59, 999);
    const user   = req.user;
    const period = req.query.period || 'this_month';

    const { start, end, months: periodMonths, label: periodLabel } = getPeriodRange(period, now);

    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const dayOfMonth   = now.getDate();
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const { Account, Commitment, CommitmentLog } = getAccountModels();

    // ── 1. Account balances (always current) ──────────────────────────────
    const accounts     = await Account.find({ userId: user._id, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const hasAccounts  = accounts.length > 0;

    // ── 2. Unpaid commitments for CURRENT month (always current) ──────────
    const allCommitments = await Commitment.find({ userId: user._id, isActive: true });
    const paidThisMonth  = await CommitmentLog.find({
      userId: user._id, month: currentMonth, year: currentYear, isPaid: true,
    });
    const paidIds         = new Set(paidThisMonth.map(l => l.commitmentId?.toString()));
    const unpaidCommitments = allCommitments
      .filter(c => !paidIds.has(c._id.toString()))
      .reduce((s, c) => s + c.amount, 0);
    const safeToSpend = totalBalance - unpaidCommitments;

    // ── 3. Commitment payments ACTUALLY PAID in the selected period ────────
    //    Uses paidOn date (the real payment date, not dueDay)
    const paidLogsInPeriod = await CommitmentLog.find({
      userId:  user._id,
      isPaid:  true,
      paidOn:  { $gte: start, $lte: end },
    });
    const commitmentsPaidAmount = paidLogsInPeriod.reduce(
      (s, l) => s + (l.actualAmount || 0), 0
    );

    // ── 4. Variable spend in period (excludes commitment payments + ATM) ───
    const varTxns = await Transaction.find({
      userId:              user._id,
      date:                { $gte: start, $lte: period === 'this_month' ? today : end },
      isATMWithdrawal:     { $ne: true },
      isCommitmentPayment: { $ne: true },
    });
    const variableSpend = varTxns.reduce((s, t) => s + t.amount, 0);

    // ── 5. Total money out for the period ─────────────────────────────────
    const totalMoneyOut = variableSpend + commitmentsPaidAmount;

    // Display value (average for 3mo)
    const displaySpent = period === '3_months' && periodMonths
      ? Math.round(totalMoneyOut / periodMonths)
      : totalMoneyOut;

    // ── 6. Budget / pool ──────────────────────────────────────────────────
    const effectiveBudget  = getEffectiveBudget(user);
    const budget           = effectiveBudget.amount;
    const poolAmount       = budget || 0;
    const poolRemaining    = poolAmount ? poolAmount - (period === '3_months' ? displaySpent : totalMoneyOut) : null;
    const budgetRemaining  = poolRemaining;

    // ── 7. Regret score (from variable txns in period) ─────────────────────
    const rated       = varTxns.filter(t => t.regretStatus !== 'pending');
    const regretCount = rated.filter(t => t.regretStatus === 'regret').length;
    const regretScore = rated.length > 0 ? Math.round((regretCount / rated.length) * 100) : 0;

    const regretBreakdown = {
      regret:   { count: 0, total: 0 },
      okay:     { count: 0, total: 0 },
      worth_it: { count: 0, total: 0 },
      rated: rated.length,
      total: varTxns.length,
    };
    rated.forEach(t => {
      if (regretBreakdown[t.regretStatus]) {
        regretBreakdown[t.regretStatus].count++;
        regretBreakdown[t.regretStatus].total += t.amount;
      }
    });

    // ── 8. Category breakdown ─────────────────────────────────────────────
    const categoryMap = {};
    varTxns.forEach(t => { categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount; });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // ── 9. Daily spending (only for this_month and last_month) ───────────
    const dailyMap = {};
    if (period === 'this_month' || period === 'last_month') {
      varTxns.forEach(t => {
        const day = new Date(t.date).getDate();
        dailyMap[day] = (dailyMap[day] || 0) + t.amount;
      });
    }
    const todayDay = now.getDate();
    const dailySpend = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= todayDay) {
        let cumulative = 0;
        for (let i = 1; i <= d; i++) cumulative += dailyMap[i] || 0;
        dailySpend.push({ day: d, amount: dailyMap[d] || 0, cumulative });
      } else {
        dailySpend.push({ day: d, amount: null, cumulative: null });
      }
    }

    // ── 10. Forecast (this_month only) ────────────────────────────────────
    let forecastTotal = 0, forecastConfidence = 'high', forecastMessage = null;
    if (period === 'this_month') {
      if (dayOfMonth === 1) {
        forecastTotal = null; forecastConfidence = 'none'; forecastMessage = 'new_month';
      } else if (dayOfMonth < 5) {
        const lm = currentMonth === 1 ? 12 : currentMonth - 1;
        const ly = currentMonth === 1 ? currentYear - 1 : currentYear;
        const lmTxns = await Transaction.find({ userId: user._id, date: { $gte: new Date(ly, lm - 1, 1), $lte: new Date(ly, lm, 0, 23, 59, 59) }, isATMWithdrawal: { $ne: true }, isCommitmentPayment: { $ne: true } });
        const lmTotal = lmTxns.reduce((s, t) => s + t.amount, 0);
        const lmDailyAvg = lmTotal / new Date(ly, lm, 0).getDate();
        const blendedAvg = ((variableSpend / dayOfMonth) * (dayOfMonth / 5)) + (lmDailyAvg * (1 - dayOfMonth / 5));
        forecastTotal = Math.round(variableSpend + (blendedAvg * (daysInMonth - dayOfMonth)));
        forecastConfidence = 'low'; forecastMessage = 'early_estimate';
      } else {
        forecastTotal = Math.round((variableSpend / dayOfMonth) * daysInMonth);
        forecastConfidence = dayOfMonth >= 15 ? 'high' : 'medium';
      }
    }

    // ── 11. Pending regret + streak ───────────────────────────────────────
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const pendingRegret = await Transaction.find({
      userId: user._id, regretStatus: 'pending',
      date: { $lte: yesterday }, isGuiltyFreeSpend: { $ne: true },
    }).limit(5);

    const streak = await calculateCurrentStreak(user._id);
    if (streak !== user.zeroDayStreak) {
      await User.findByIdAndUpdate(user._id, { zeroDayStreak: streak });
    }

    // ── 12. Recent transactions (always current month view) ───────────────
    const recentTxns = await Transaction.find({
      userId: user._id, date: { $gte: new Date(currentYear, currentMonth - 1, 1), $lte: today },
    }).sort({ date: -1 }).limit(10);

    res.json({
      success: true,
      // Period meta
      period,
      periodLabel,
      spentLabel: { this_month: 'SPENT THIS MONTH', last_month: 'SPENT LAST MONTH', '3_months': 'AVG MONTHLY SPEND', all_time: 'TOTAL SPENT' }[period],

      // KPI data
      kpi: {
        totalSpent: totalMoneyOut,        // now includes commitment payments
        variableSpend,
        commitmentsPaidAmount,
        displaySpent,
        budgetRemaining,
        poolAmount,
        poolRemaining,
        regretScore,
        zeroDayStreak: streak,
        budget,
        budgetSource: effectiveBudget.source,
        budgetLabel:  effectiveBudget.label,
        isOverBudget: budget ? displaySpent > budget : false,
        budgetPercent: budget ? Math.min(Math.round((displaySpent / budget) * 100), 100) : null,
      },

      // Charts
      categoryBreakdown,
      dailySpend,

      // Forecast
      forecast: {
        forecastTotal,
        budget,
        budgetLabel: effectiveBudget.label,
        overshoot: (forecastTotal && budget) ? forecastTotal - budget : 0,
        confidence: forecastConfidence,
        message: forecastMessage,
        dayOfMonth,
      },

      // Regret
      pendingRegret: pendingRegret.map(t => ({ id: t._id, title: t.title, amount: t.amount, date: t.date, category: t.category })),
      recentTransactions: recentTxns,
      regretBreakdown,

      // Account-based Safe to Spend (always current)
      totalBalance,
      safeToSpend,
      unpaidCommitments,
      hasAccounts,
      accounts: accounts.map(a => ({ _id: a._id, name: a.name, type: a.type, balance: a.balance, isDefault: a.isDefault, color: a.color })),
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
const getPaidCommitmentsTotal = async (userId, period, startDate, endDate) => {
  const CommitmentLog = require('../models/CommitmentLog');
  // Always use actual paid records by paidOn date — fixes the 3× bug
  // For all_time, endDate may be the current end-of-month
  const query = { userId, isPaid: true };
  if (startDate) query.paidOn = { $gte: startDate };
  if (endDate)   query.paidOn = { ...(query.paidOn || {}), $lte: endDate };
  const logs = await CommitmentLog.find(query);
  return logs.reduce((sum, log) => sum + (log.actualAmount || 0), 0);
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
      endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
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

    const commitmentsTotal = await getPaidCommitmentsTotal(req.user._id, period, startDate, endDate);
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

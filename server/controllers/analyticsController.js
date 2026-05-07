const Transaction   = require('../models/Transaction');
const User          = require('../models/User');
const { getEffectiveBudget } = require('../utils/budgetHelpers');
const { calculateCurrentStreak } = require('../utils/zeroDayEngine');
const {
  getPeriodBounds,
  localMonthBounds,
  getSpendingForPeriod,
  getUnpaidCommitmentsForMonth,
  getPeriodPool,
} = require('../utils/spendCalculator');

// Lazy-load models only needed in some paths
const getAccountModels = () => ({
  Account:       require('../models/Account'),
  Commitment:    require('../models/Commitment'),
  CommitmentLog: require('../models/CommitmentLog'),
});

// ─── Label helpers ────────────────────────────────────────────────────────────
function getSpentLabel(period) {
  return {
    this_month: 'SPENT THIS MONTH',
    last_month: 'SPENT LAST MONTH',
    '3_months': 'AVG MONTHLY SPEND',
    all_time:   'TOTAL SPENT',
  }[period] || 'SPENT';
}
function getRemainingLabel(period) {
  return {
    this_month: 'POOL REMAINING',
    last_month: 'LAST MONTH REMAINING',
    '3_months': 'AVG MONTHLY REMAINING',
    all_time:   'AVG MONTHLY REMAINING',
  }[period] || 'REMAINING';
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const now    = new Date();
    const user   = req.user;
    const period = req.query.period || 'this_month';

    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const dayOfMonth   = now.getDate();
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const { Account, Commitment, CommitmentLog } = getAccountModels();

    // ── 1. Account balances (always current — never period-based) ─────────
    const accounts     = await Account.find({ userId: user._id, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const hasAccounts  = accounts.length > 0;

    // ── 2. Unpaid commitments — always current month ───────────────────────
    //    Safe to Spend = Balance − unpaid bills only.
    //    PAID bills are already gone from the balance. Don't subtract twice.
    const unpaid     = await getUnpaidCommitmentsForMonth(user._id, currentMonth, currentYear);
    const safeToSpend = totalBalance - unpaid.total;

    // ── 3. Period-specific spending breakdown ─────────────────────────────
    const { start, end, months: periodMonths, label: periodLabel } = getPeriodBounds(period, now);

    // How many months of data for all_time scaling?
    const fullUser     = await User.findById(user._id).select('createdAt monthlyBudget monthlySalary spendingPool moneyMode');
    const createdAt    = fullUser?.createdAt || new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const monthsOfData = Math.max(1, Math.round(
      Math.abs(now - createdAt) / (1000 * 60 * 60 * 24 * 30)
    ));
    const activePeriodMonths = period === 'all_time'
      ? monthsOfData
      : (periodMonths || 1);

    const spending = await getSpendingForPeriod(user._id, start, end);

    // Display value (average for 3-month periods)
    const displaySpent = period === '3_months'
      ? Math.round(spending.totalMoneyOut / 3)
      : spending.totalMoneyOut;

    // ── 4. Budget / pool — scaled for period ─────────────────────────────
    const effectiveBudget = getEffectiveBudget(fullUser || user);
    const monthlyPool     = effectiveBudget.amount || 0;
    const periodPool      = getPeriodPool(monthlyPool, period, monthsOfData);

    // Pool remaining — use totalMoneyOut (not displaySpent) for raw calc
    const poolRemaining = monthlyPool > 0 ? periodPool - spending.totalMoneyOut : null;

    // Display remaining (show monthly avg for multi-month periods)
    const displayRemaining = poolRemaining === null ? null
      : period === '3_months'  ? Math.round(poolRemaining / 3)
      : period === 'all_time'  ? Math.round(poolRemaining / monthsOfData)
      : poolRemaining;

    // Progress % based on period-scaled pool (prevents 100% for all_time)
    const progressPct = periodPool > 0
      ? Math.min(Math.round((spending.totalMoneyOut / periodPool) * 100), 100)
      : 0;
    const isOverBudget = poolRemaining !== null && poolRemaining < 0;

    // ── 5. Regret score ────────────────────────────────────────────────────
    const varTxns     = await Transaction.find({
      userId:              user._id,
      date:                { $gte: start, $lte: end },
      isATMWithdrawal:     { $ne: true },
      isCommitmentPayment: { $ne: true },
    });
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

    // ── 6. Category breakdown (for pie chart) ─────────────────────────────
    const categoryMap = {};
    varTxns.forEach(t => { categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount; });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // ── 7. Daily spending chart (for this_month / last_month only) ────────
    //    For 3_months and all_time, the frontend handles grouping from chartDataRaw
    const { start: mStart, end: mEnd } = period === 'last_month'
      ? (() => {
          const lm = currentMonth === 1 ? 12 : currentMonth - 1;
          const ly = currentMonth === 1 ? currentYear - 1 : currentYear;
          return { start: new Date(ly, lm - 1, 1), end: new Date(ly, lm, 0, 23, 59, 59) };
        })()
      : { start: new Date(currentYear, currentMonth - 1, 1), end: new Date() };

    const chartTxns = (period === 'this_month' || period === 'last_month') ? varTxns : [];
    const dailyMap  = {};
    chartTxns.forEach(t => {
      const day = new Date(t.date).getDate();
      dailyMap[day] = (dailyMap[day] || 0) + t.amount;
    });

    const chartDaysInMonth = period === 'last_month'
      ? new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate()
      : daysInMonth;

    const dailySpend = [];
    for (let d = 1; d <= chartDaysInMonth; d++) {
      const isFuture = period === 'this_month' && d > dayOfMonth;
      let cumulative = 0;
      for (let i = 1; i <= d; i++) cumulative += dailyMap[i] || 0;
      dailySpend.push({
        day:        d,
        amount:     isFuture ? null : (dailyMap[d] || 0),
        cumulative: isFuture ? null : cumulative,
      });
    }

    // ── 8. Forecast (this_month only) ─────────────────────────────────────
    let forecastTotal = 0, forecastConfidence = 'high', forecastMessage = null;
    if (period === 'this_month') {
      if (dayOfMonth === 1) {
        forecastTotal = null; forecastConfidence = 'none'; forecastMessage = 'new_month';
      } else if (dayOfMonth < 5) {
        const lm = currentMonth === 1 ? 12 : currentMonth - 1;
        const ly = currentMonth === 1 ? currentYear - 1 : currentYear;
        const lmBounds = { start: new Date(ly, lm - 1, 1), end: new Date(ly, lm, 0, 23, 59, 59) };
        const lmSpend  = await getSpendingForPeriod(user._id, lmBounds.start, lmBounds.end);
        const lmDays   = new Date(ly, lm, 0).getDate();
        const lmAvg    = lmSpend.variableTotal / lmDays;
        const blended  = ((spending.variableTotal / dayOfMonth) * (dayOfMonth / 5)) + (lmAvg * (1 - dayOfMonth / 5));
        forecastTotal  = Math.round(spending.variableTotal + blended * (daysInMonth - dayOfMonth));
        forecastConfidence = 'low'; forecastMessage = 'early_estimate';
      } else {
        forecastTotal  = Math.round((spending.variableTotal / dayOfMonth) * daysInMonth);
        forecastConfidence = dayOfMonth >= 15 ? 'high' : 'medium';
      }
    }

    // ── 9. Pending regret + streak ────────────────────────────────────────
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const pendingRegret = await Transaction.find({
      userId: user._id, regretStatus: 'pending',
      date: { $lte: yesterday }, isGuiltyFreeSpend: { $ne: true },
    }).limit(5);

    const streak = await calculateCurrentStreak(user._id);
    if (streak !== user.zeroDayStreak) {
      await User.findByIdAndUpdate(user._id, { zeroDayStreak: streak });
    }

    // ── 10. Recent transactions ────────────────────────────────────────────
    const { start: thisMonthStart } = localMonthBounds(currentMonth, currentYear);
    const recentTxns = await Transaction.find({
      userId: user._id,
      date:   { $gte: thisMonthStart, $lte: new Date() },
    }).sort({ date: -1 }).limit(10);

    // ── Response ──────────────────────────────────────────────────────────
    res.json({
      success: true,

      // Period meta
      period,
      periodLabel,
      spentLabel:     getSpentLabel(period),
      remainingLabel: getRemainingLabel(period),

      // KPI data
      kpi: {
        // Spent
        totalSpent:           spending.totalMoneyOut,
        variableSpend:        spending.variableTotal,
        commitmentsPaidAmount: spending.billsPaidTotal,
        displaySpent,         // monthly avg for 3_months

        // Pool / budget
        budget:           monthlyPool,
        poolAmount:       monthlyPool,
        periodPool,
        poolRemaining:    displayRemaining,
        isOverBudget,
        progressPct,
        budgetSource:     effectiveBudget.source,
        budgetLabel:      effectiveBudget.label,
        budgetPercent:    progressPct,
        budgetRemaining:  displayRemaining,

        // Other KPIs
        regretScore,
        zeroDayStreak: streak,
      },

      // Charts
      categoryBreakdown,
      dailySpend,

      // Forecast
      forecast: {
        forecastTotal,
        budget:       monthlyPool,
        budgetLabel:  effectiveBudget.label,
        overshoot:    (forecastTotal && monthlyPool) ? forecastTotal - monthlyPool : 0,
        confidence:   forecastConfidence,
        message:      forecastMessage,
        dayOfMonth,
      },

      // Regret
      pendingRegret: pendingRegret.map(t => ({
        id: t._id, title: t.title, amount: t.amount, date: t.date, category: t.category,
      })),
      recentTransactions: recentTxns,
      regretBreakdown,

      // ── SAFE TO SPEND (always current, never period-based) ─────────────
      //    Formula: Account Balance − Unpaid bills only.
      //    Paid bills are already reflected in the balance. Don't subtract twice.
      totalBalance,
      safeToSpend,
      unpaidCommitments: unpaid.total,
      unpaidItems: unpaid.items.map(c => ({ _id: c._id, title: c.title, amount: c.amount, dueDay: c.dueDay })),
      hasAccounts,
      accounts: accounts.map(a => ({
        _id: a._id, name: a.name, type: a.type,
        balance: a.balance, isDefault: a.isDefault, color: a.color,
      })),
    });
  } catch (err) { next(err); }
};

// ─── Other analytics endpoints (unchanged logic) ──────────────────────────────

const getMonthly = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txns  = await Transaction.find({ userId: req.user._id, date: { $gte: start, $lte: end } });
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
    txns.forEach(t => { const day = days[new Date(t.date).getDay()]; dayMap[day].push(t.amount); });
    const result = days.map(d => ({
      day: d,
      avg: dayMap[d].length > 0 ? Math.round(dayMap[d].reduce((s, a) => s + a, 0) / dayMap[d].length) : 0,
    }));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getFutureValue = async (req, res, next) => {
  try {
    const { amount, rate = 12, years = 5 } = req.query;
    const pv = parseFloat(amount) || 0;
    const r  = parseFloat(rate) / 100;
    const n  = parseFloat(years);
    const fv = pv * Math.pow(1 + r, n);
    res.json({ success: true, presentValue: pv, futureValue: Math.round(fv), rate, years });
  } catch (err) { next(err); }
};

const getForecast = async (req, res, next) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txns  = await Transaction.find({ userId: req.user._id, date: { $gte: start } });
    const totalSpent   = txns.reduce((s, t) => s + t.amount, 0);
    const daysElapsed  = now.getDate();
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const avgPerDay    = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const forecast     = Math.round(avgPerDay * daysInMonth);
    const eb           = getEffectiveBudget(req.user);
    res.json({ success: true, totalSpent, forecast, daysElapsed, daysInMonth, budget: eb.amount, budgetLabel: eb.label });
  } catch (err) { next(err); }
};

const getCategoryTrends = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d     = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txns  = await Transaction.find({ userId: req.user._id, date: { $gte: start, $lte: end } });
      const entry = { month: start.toLocaleString('default', { month: 'short' }) };
      txns.forEach(t => { entry[t.category] = (entry[t.category] || 0) + t.amount; });
      result.push(entry);
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── getTfm (legacy waterfall, kept for sparkline) ───────────────────────────
const getTfm = async (req, res, next) => {
  try {
    const Account       = require('../models/Account');
    const period        = req.query.period || 'this_month';
    const now           = new Date();

    const { start, end, months: pm } = getPeriodBounds(period, now);
    const numberOfMonths = period === 'all_time'
      ? (() => {
          const u = req.user;
          const days = Math.ceil(Math.abs(now - (u.createdAt || now)) / (1000 * 60 * 60 * 24));
          return Math.max(1, Math.round(days / 30));
        })()
      : (pm || 1);

    const accounts     = await Account.find({ userId: req.user._id, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const hasAccounts  = accounts.length > 0;

    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const unpaid       = await getUnpaidCommitmentsForMonth(req.user._id, currentMonth, currentYear);
    const safeToSpend  = totalBalance - unpaid.total;

    const spending = await getSpendingForPeriod(req.user._id, start, end);

    res.json({
      success: true,
      totalBalance,
      hasAccounts,
      safeToSpend,
      unpaidCommitments: unpaid.total,
      commitmentsTotal:  spending.billsPaidTotal,
      variableSpend:     spending.variableTotal,
      trueFreeMoney:     safeToSpend - spending.variableTotal,
      period,
      numberOfMonths,
      // Legacy fields
      pool:            totalBalance,
      actualIncome:    null,
      isCarryForward:  false,
      carryForwardAmount: 0,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getDashboard,
  getMonthly,
  getDayOfWeek,
  getFutureValue,
  getForecast,
  getCategoryTrends,
  getTfm,
};

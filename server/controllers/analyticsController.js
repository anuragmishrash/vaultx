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
    const userId = req.user._id;
    const period = req.query.period || 'this_month';
    const now    = new Date();

    const { Account, Commitment, CommitmentLog } = getAccountModels();

    // Always-current data
    const accounts      = await Account.find({ userId, isActive: true });
    const totalBalance  = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const user          = await User.findById(userId).select('monthlySalary monthlyBudget spendingPool createdAt zeroDayStreak');
    
    const getEffectivePool = (u, balance) => {
      if (u?.spendingPool > 0)  return { amount: u.spendingPool,  source: 'pool',    label: 'Spending pool' };
      if (u?.monthlyBudget > 0) return { amount: u.monthlyBudget, source: 'budget',  label: 'Monthly budget' };
      if (u?.monthlySalary > 0) return { amount: u.monthlySalary, source: 'salary',  label: 'Monthly salary' };
      if (balance > 0)          return { amount: balance,         source: 'balance', label: 'Account balance' };
      return                    { amount: 0,                      source: 'none',    label: 'No reference set' };
    };

    const poolInfo   = getEffectivePool(user, totalBalance);
    const poolAmount = poolInfo.amount;
    const poolSource = poolInfo.source;
    const poolLabel  = poolInfo.label;
    
    const currentMonth  = now.getMonth() + 1;
    const currentYear   = now.getFullYear();
    const unpaid        = await getUnpaidCommitmentsForMonth(userId, currentMonth, currentYear);
    const safeToSpend   = totalBalance - unpaid.total;  // NEVER subtract paid bills again

    // Period data
    const { start: startDate, end: endDate, label } = getPeriodBounds(period, now);
    const spending = await getSpendingForPeriod(userId, startDate, endDate);

    // Months since account created
    const monthsOfData = Math.max(1,
      Math.round((now - new Date(user.createdAt)) / (1000 * 60 * 60 * 24 * 30))
    );

    // Pool calculation — variable spend only, not bills
    let displayVariableSpend, displayRemaining, progressPct, isOverBudget, remainingLabel;

    if (period === 'all_time') {
      displayVariableSpend = spending.variableTotal;
      displayRemaining     = Math.max(0, poolAmount - Math.round(spending.variableTotal / monthsOfData));
      progressPct          = null;
      isOverBudget         = false;
      remainingLabel       = 'AVG MONTHLY REMAINING';
    } else if (period === '3_months') {
      displayVariableSpend = Math.round(spending.variableTotal / 3);  // monthly avg
      displayRemaining     = poolAmount - displayVariableSpend;
      progressPct          = Math.min(Math.round((displayVariableSpend / poolAmount) * 100), 100);
      isOverBudget         = displayRemaining < 0;
      remainingLabel       = 'AVG MONTHLY REMAINING';
    } else {
      displayVariableSpend = spending.variableTotal;
      displayRemaining     = poolAmount - spending.variableTotal;
      progressPct          = Math.min(Math.round((spending.variableTotal / poolAmount) * 100), 100);
      isOverBudget         = displayRemaining < 0;
      remainingLabel       = period === 'last_month' ? 'LAST MONTH REMAINING' : 'POOL REMAINING';
    }

    // Regret score
    const varTxns     = await Transaction.find({
      userId:              user._id,
      date:                { $gte: startDate, $lte: endDate },
      isATMWithdrawal:     { $ne: true },
      isCommitmentPayment: { $ne: true },
    });
    const rated       = varTxns.filter(t => t.regretStatus !== 'pending');
    const regretCount = rated.filter(t => t.regretStatus === 'regret').length;
    const regretScore = rated.length > 0 ? Math.round((regretCount / rated.length) * 100) : 0;
    
    // Regret Breakdown
    const regretBreakdown = { regret: { count: 0, total: 0 }, okay: { count: 0, total: 0 }, worth_it: { count: 0, total: 0 }, rated: rated.length, total: varTxns.length };
    rated.forEach(t => { if (regretBreakdown[t.regretStatus]) { regretBreakdown[t.regretStatus].count++; regretBreakdown[t.regretStatus].total += t.amount; } });

    // Category Map
    const categoryMap = {};
    varTxns.forEach(t => { categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount; });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Pending Regret & Recent
    const pendingRegret = await Transaction.find({ userId, regretStatus: 'pending', date: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, isCommitmentPayment: { $ne: true } }).sort({ date: -1 }).limit(10);
    const recentTxns = await Transaction.find({ userId, isCommitmentPayment: { $ne: true } }).sort({ createdAt: -1 }).limit(5);

    const { calculateCurrentStreak } = require('../utils/zeroDayEngine');
    const streak      = await calculateCurrentStreak(userId);

    // Chart logic
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

    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const chartDaysInMonth = period === 'last_month'
      ? new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate()
      : (period === 'this_month' ? dayOfMonth : daysInMonth);

    const dailySpend = [];
    for (let d = 1; d <= chartDaysInMonth; d++) {
      let cumulative = 0;
      for (let i = 1; i <= d; i++) cumulative += dailyMap[i] || 0;
      dailySpend.push({
        day:        d,
        amount:     dailyMap[d] || 0,
        cumulative: cumulative,
      });
    }

    // Forecast
    let forecastTotal = 0, forecastConfidence = 'high', forecastMessage = null;
    if (period === 'this_month') {
      if (dayOfMonth >= 5 && daysInMonth > 0) {
        const spendToDate = spending.variableTotal; // Predict based on variable spend
        const dailyAvg    = spendToDate / dayOfMonth;
        forecastTotal     = Math.round(spendToDate + (dailyAvg * (daysInMonth - dayOfMonth)));
        forecastConfidence = dayOfMonth >= 20 ? 'high' : dayOfMonth >= 10 ? 'medium' : 'low';
        forecastMessage   = `Based on ₹${Math.round(dailyAvg)}/day avg`;
      }
    }

    res.json({
      success: true,
      period, 
      periodLabel: label,

      // KPI Card 1
      spentLabel: getSpentLabel(period),
      displayVariableSpend,
      billsPaid: spending.billsPaidTotal,
      progressPct,

      // KPI Card 2
      poolAmount,
      poolLabel,
      poolSource,
      displayRemaining,
      isOverBudget,
      remainingLabel,

      // KPI 3 & 4
      regretScore,
      zeroDayStreak: streak,

      // Safe to Spend = Balance − all money out this period
      safeToSpend: totalBalance - spending.totalMoneyOut,
      totalBalance,
      unpaidCommitments: unpaid.total,
      unpaidItems: unpaid.items,

      // Informational for Safe to Spend widget breakdown
      infoBillsPaid:     spending.billsPaidTotal,
      infoVariableSpend: spending.variableTotal,
      infoGuiltFree:     spending.guiltyFreeTotal,
      totalMoneyOut:     spending.totalMoneyOut,
      monthsOfData,
      avgMonthlySpend:   Math.round(spending.variableTotal / monthsOfData),

      // Accounts
      hasAccounts: accounts.length > 0,
      accounts: accounts.map(a => ({
        _id: a._id, name: a.name, balance: a.balance,
        isDefault: a.isDefault, color: a.color, type: a.type
      })),

      // Legacy / Additional
      categoryBreakdown,
      dailySpend,
      forecast: {
        forecastTotal,
        budget: poolAmount,
        budgetLabel: poolLabel,
        overshoot: (forecastTotal && poolAmount) ? forecastTotal - poolAmount : 0,
        confidence: forecastConfidence,
        message: forecastMessage,
        dayOfMonth
      },
      pendingRegret: pendingRegret.map(t => ({
        id: t._id, title: t.title, amount: t.amount, date: t.date, category: t.category,
      })),
      recentTransactions: recentTxns,
      regretBreakdown
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

    const spending = await getSpendingForPeriod(req.user._id, start, end);
    const safeToSpend  = totalBalance - spending.totalMoneyOut;

    res.json({
      success: true,
      totalBalance,
      hasAccounts,
      safeToSpend,
      unpaidCommitments: 0,
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

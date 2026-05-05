const CashEnvelope = require('../models/CashEnvelope');
const Transaction = require('../models/Transaction');

const getOrCreateEnvelope = async (userId, month, year) => {
  let env = await CashEnvelope.findOne({ userId, month, year });
  if (!env) {
    env = await CashEnvelope.create({ userId, month, year, openingBalance: 0, currentBalance: 0 });
  }
  return env;
};

const recomputeEnvelope = async (userId, month, year) => {
  const env = await getOrCreateEnvelope(userId, month, year);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const cashSpends = await Transaction.find({ userId, isCashSpend: true, isATMWithdrawal: false, date: { $gte: start, $lte: end } });
  const atmWithdrawals = await Transaction.find({ userId, isATMWithdrawal: true, date: { $gte: start, $lte: end } });

  const totalLogged = cashSpends.reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = atmWithdrawals.reduce((s, t) => s + t.amount, 0);
  const currentBalance = env.openingBalance + totalWithdrawn - totalLogged;

  env.totalLogged = totalLogged;
  env.totalWithdrawn = totalWithdrawn;
  env.currentBalance = currentBalance;
  await env.save();
  return env;
};

// GET /api/cash/envelope?month=&year=
exports.getEnvelope = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const env = await recomputeEnvelope(req.user.id, month, year);

    const totalIn = env.openingBalance + env.totalWithdrawn;
    const progressPct = totalIn > 0 ? Math.round((env.totalLogged / totalIn) * 100) : 0;

    res.json({ envelope: env, totalIn, progressPct });
  } catch (err) { next(err); }
};

// POST /api/cash/envelope
exports.createEnvelope = async (req, res, next) => {
  try {
    const { openingBalance, month, year } = req.body;
    if (!openingBalance || isNaN(openingBalance))
      return res.status(400).json({ message: 'Opening balance required' });

    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    const env = await CashEnvelope.findOneAndUpdate(
      { userId: req.user.id, month: m, year: y },
      {
        openingBalance: parseFloat(openingBalance),
        currentBalance: parseFloat(openingBalance),
        userId: req.user.id,
        month: m,
        year: y,
      },
      { upsert: true, new: true }
    );

    const updated = await recomputeEnvelope(req.user.id, m, y);
    res.json({ envelope: updated });
  } catch (err) { next(err); }
};

// PATCH /api/cash/envelope/count
exports.countWallet = async (req, res, next) => {
  try {
    const { physicalCount } = req.body;
    if (physicalCount === undefined || isNaN(physicalCount))
      return res.status(400).json({ message: 'Physical count required' });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const env = await recomputeEnvelope(req.user.id, month, year);
    const gap = env.currentBalance - parseFloat(physicalCount);

    if (gap > 0) {
      // Log untracked cash as a transaction
      await Transaction.create({
        userId: req.user.id,
        title: 'Untracked Cash',
        amount: gap,
        category: 'Others',
        paymentMode: 'Cash',
        isCashSpend: true,
        date: new Date(),
        regretStatus: 'pending',
        note: `Auto-logged: wallet count gap of ₹${gap}`,
        tags: ['untracked', 'cash'],
      });
    }

    env.lastPhysicalCount = parseFloat(physicalCount);
    env.lastCountedAt = new Date();
    env.untrackedAmount = gap > 0 ? gap : 0;
    await env.save();

    const updated = await recomputeEnvelope(req.user.id, month, year);
    res.json({ envelope: updated, gap, message: gap > 0 ? `₹${gap} logged as Untracked Cash` : 'All cash accounted for!' });
  } catch (err) { next(err); }
};

// GET /api/cash/analytics?months=6
exports.getCashAnalytics = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const data = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const cashTxns = await Transaction.find({ userId: req.user.id, isCashSpend: true, isATMWithdrawal: false, date: { $gte: start, $lte: end } });
      const allTxns = await Transaction.find({ userId: req.user.id, isATMWithdrawal: false, date: { $gte: start, $lte: end } });

      const cashTotal = cashTxns.reduce((s, t) => s + t.amount, 0);
      const allTotal = allTxns.reduce((s, t) => s + t.amount, 0);
      const digitalTotal = allTotal - cashTotal;

      // Biggest cash category
      const catMap = {};
      cashTxns.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
      const biggestCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Untracked
      const env = await CashEnvelope.findOne({ userId: req.user.id, month, year });
      const untracked = env?.untrackedAmount || 0;

      data.push({
        month: d.toLocaleString('default', { month: 'short' }),
        cashTotal, digitalTotal, allTotal,
        cashPct: allTotal > 0 ? Math.round((cashTotal / allTotal) * 100) : 0,
        biggestCat, untracked,
      });
    }

    res.json({ data });
  } catch (err) { next(err); }
};

// GET /api/cash/ratio?month=&year=
exports.getCashRatio = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const txns = await Transaction.find({ userId: req.user.id, isATMWithdrawal: false, date: { $gte: start, $lte: end } });
    const cashTotal = txns.filter(t => t.isCashSpend).reduce((s, t) => s + t.amount, 0);
    const digitalTotal = txns.filter(t => !t.isCashSpend).reduce((s, t) => s + t.amount, 0);
    const allTotal = cashTotal + digitalTotal;

    // Category breakdown for cash
    const catMap = {};
    txns.filter(t => t.isCashSpend).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

    res.json({
      cashTotal, digitalTotal, allTotal,
      cashPct: allTotal > 0 ? Math.round((cashTotal / allTotal) * 100) : 0,
      digitalPct: allTotal > 0 ? Math.round((digitalTotal / allTotal) * 100) : 0,
      categoryBreakdown: Object.entries(catMap).map(([cat, total]) => ({ cat, total })).sort((a, b) => b.total - a.total),
    });
  } catch (err) { next(err); }
};

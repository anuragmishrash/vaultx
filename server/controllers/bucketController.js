const User = require('../models/User');
const MoneyBucket = require('../models/MoneyBucket');
const CommitmentLog = require('../models/CommitmentLog');

// PATCH /api/user/money-mode
exports.setMoneyMode = async (req, res, next) => {
  try {
    const { moneyMode } = req.body;
    if (!['salary', 'pool', 'wallet'].includes(moneyMode))
      return res.status(400).json({ message: 'Invalid money mode' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { moneyMode },
      { new: true, select: '-password -refreshToken' }
    );
    res.json({ user });
  } catch (err) { next(err); }
};

// PATCH /api/user/spending-pool
exports.setSpendingPool = async (req, res, next) => {
  try {
    const { amount, month, year } = req.body;
    if (!amount || isNaN(amount))
      return res.status(400).json({ message: 'Valid amount required' });

    const now = new Date();
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        spendingPool: parseFloat(amount),
        spendingPoolMonth: month || now.getMonth() + 1,
        spendingPoolYear: year || now.getFullYear(),
        moneyMode: 'pool',
      },
      { new: true, select: '-password -refreshToken' }
    );
    res.json({ user });
  } catch (err) { next(err); }
};

// PATCH /api/user/hide-wallet-balance
exports.setHideBalance = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { hideWalletBalance: req.body.hide },
      { new: true, select: '-password -refreshToken' }
    );
    res.json({ user });
  } catch (err) { next(err); }
};

// ---------- MONEY BUCKET CONTROLLERS ----------

// GET /api/buckets
exports.getBuckets = async (req, res, next) => {
  try {
    const buckets = await MoneyBucket.find({ userId: req.user.id, isActive: true }).sort({ isPrimary: -1, createdAt: 1 });
    const total = buckets.reduce((s, b) => s + b.balance, 0);

    // Safe to Spend = total balance - unpaid commitments this month
    const now = new Date();
    const unpaidLogs = await CommitmentLog.find({
      userId: req.user.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      isPaid: false,
    }).populate('commitmentId');

    const unpaidTotal = unpaidLogs.reduce((s, log) => {
      const amt = log.commitmentId?.amount || 0;
      return s + amt;
    }, 0);

    const safeToSpend = total - unpaidTotal;

    res.json({ buckets, total, safeToSpend, unpaidTotal });
  } catch (err) { next(err); }
};

// POST /api/buckets
exports.createBucket = async (req, res, next) => {
  try {
    const { name, type, balance, isPrimary } = req.body;
    if (!name) return res.status(400).json({ message: 'Bucket name required' });

    // Only one primary bucket
    if (isPrimary) {
      await MoneyBucket.updateMany({ userId: req.user.id }, { isPrimary: false });
    }

    const bucket = await MoneyBucket.create({
      userId: req.user.id,
      name,
      type: type || 'bank_account',
      balance: parseFloat(balance) || 0,
      isPrimary: !!isPrimary,
      lastUpdated: new Date(),
      balanceHistory: [{ balance: parseFloat(balance) || 0, recordedAt: new Date(), note: 'Initial balance' }],
    });

    res.status(201).json({ bucket });
  } catch (err) { next(err); }
};

// PUT /api/buckets/:id
exports.updateBucket = async (req, res, next) => {
  try {
    const { name, type, isPrimary } = req.body;
    if (isPrimary) {
      await MoneyBucket.updateMany({ userId: req.user.id, _id: { $ne: req.params.id } }, { isPrimary: false });
    }
    const bucket = await MoneyBucket.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, type, isPrimary },
      { new: true }
    );
    if (!bucket) return res.status(404).json({ message: 'Bucket not found' });
    res.json({ bucket });
  } catch (err) { next(err); }
};

// PATCH /api/buckets/:id/balance
exports.updateBalance = async (req, res, next) => {
  try {
    const { balance, note } = req.body;
    if (balance === undefined || isNaN(balance))
      return res.status(400).json({ message: 'Valid balance required' });

    const bucket = await MoneyBucket.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        balance: parseFloat(balance),
        lastUpdated: new Date(),
        $push: {
          balanceHistory: {
            balance: parseFloat(balance),
            recordedAt: new Date(),
            note: note || '',
          }
        }
      },
      { new: true }
    );
    if (!bucket) return res.status(404).json({ message: 'Bucket not found' });
    res.json({ bucket });
  } catch (err) { next(err); }
};

// DELETE /api/buckets/:id
exports.deleteBucket = async (req, res, next) => {
  try {
    await MoneyBucket.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isActive: false }
    );
    res.json({ message: 'Bucket removed' });
  } catch (err) { next(err); }
};

// POST /api/buckets/transfer
exports.transfer = async (req, res, next) => {
  try {
    const { fromId, toId, amount } = req.body;
    if (!fromId || !toId || !amount || isNaN(amount))
      return res.status(400).json({ message: 'fromId, toId, and amount required' });

    const amt = parseFloat(amount);
    const fromBucket = await MoneyBucket.findOne({ _id: fromId, userId: req.user.id });
    const toBucket = await MoneyBucket.findOne({ _id: toId, userId: req.user.id });

    if (!fromBucket || !toBucket) return res.status(404).json({ message: 'Bucket not found' });
    if (fromBucket.balance < amt) return res.status(400).json({ message: 'Insufficient balance' });

    fromBucket.balance -= amt;
    fromBucket.lastUpdated = new Date();
    fromBucket.balanceHistory.push({ balance: fromBucket.balance, recordedAt: new Date(), note: `Transfer to ${toBucket.name}` });

    toBucket.balance += amt;
    toBucket.lastUpdated = new Date();
    toBucket.balanceHistory.push({ balance: toBucket.balance, recordedAt: new Date(), note: `Transfer from ${fromBucket.name}` });

    await Promise.all([fromBucket.save(), toBucket.save()]);
    res.json({ fromBucket, toBucket, message: `Transferred ₹${amt} from ${fromBucket.name} to ${toBucket.name}` });
  } catch (err) { next(err); }
};

// GET /api/buckets/net-worth
exports.getNetWorth = async (req, res, next) => {
  try {
    const buckets = await MoneyBucket.find({ userId: req.user.id, isActive: true });
    const total = buckets.reduce((s, b) => s + b.balance, 0);

    // MoM delta — compare to first history entry 30+ days ago
    const lastMonth = new Date(); lastMonth.setDate(lastMonth.getDate() - 30);
    let prevTotal = 0;
    buckets.forEach(b => {
      const prevEntry = b.balanceHistory.filter(h => h.recordedAt <= lastMonth).pop();
      prevTotal += prevEntry ? prevEntry.balance : b.balanceHistory[0]?.balance || b.balance;
    });
    const momDelta = total - prevTotal;

    const now = new Date();
    const unpaidLogs = await CommitmentLog.find({
      userId: req.user.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      isPaid: false,
    }).populate('commitmentId');
    const unpaidTotal = unpaidLogs.reduce((s, l) => s + (l.commitmentId?.amount || 0), 0);

    const byBucket = buckets.map(b => ({
      _id: b._id,
      name: b.name,
      type: b.type,
      balance: b.balance,
      isPrimary: b.isPrimary,
      lastUpdated: b.lastUpdated,
      pct: total > 0 ? Math.round((b.balance / total) * 100) : 0,
    }));

    res.json({ total, byBucket, safeToSpend: total - unpaidTotal, unpaidTotal, momDelta });
  } catch (err) { next(err); }
};

// GET /api/buckets/net-worth/history?months=6
exports.getNetWorthHistory = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const buckets = await MoneyBucket.find({ userId: req.user.id, isActive: true });

    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      d.setHours(23, 59, 59);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      let netWorth = 0;
      buckets.forEach(b => {
        const snap = b.balanceHistory.filter(h => h.recordedAt <= endOfMonth).pop();
        netWorth += snap ? snap.balance : 0;
      });

      result.push({
        month: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        netWorth,
      });
    }

    res.json({ data: result });
  } catch (err) { next(err); }
};

// GET /api/buckets/savings-accuracy?month=&year=
exports.getSavingsAccuracy = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const user = await User.findById(req.user.id);
    const loggedIncome = user.monthlySalary || 0;

    const Transaction = require('../models/Transaction');
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const txns = await Transaction.find({ userId: req.user.id, date: { $gte: start, $lte: end }, isATMWithdrawal: { $ne: true } });
    const loggedSpending = txns.reduce((s, t) => s + t.amount, 0);
    const loggedSavings = loggedIncome - loggedSpending;

    // Actual balance change
    const buckets = await MoneyBucket.find({ userId: req.user.id, isActive: true });
    let actualChange = 0;
    buckets.forEach(b => {
      const startSnap = b.balanceHistory.filter(h => h.recordedAt >= start && h.recordedAt <= end);
      if (startSnap.length >= 2) {
        actualChange += startSnap[startSnap.length - 1].balance - startSnap[0].balance;
      }
    });

    const gap = loggedSavings - actualChange;

    res.json({
      loggedIncome,
      loggedSpending,
      loggedSavings,
      actualChange,
      gap,
      hasData: buckets.length > 0,
    });
  } catch (err) { next(err); }
};

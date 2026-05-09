const router = require('express').Router();
const { protect } = require('../middleware/auth');
const Account = require('../models/Account');
const User = require('../models/User');
const CommitmentLog = require('../models/CommitmentLog');
const Commitment = require('../models/Commitment');
const mongoose = require('mongoose');
const { safeEmit } = require('../socket');

const toId = (id) => new mongoose.Types.ObjectId(id.toString());

// ── GET /api/accounts — list all active accounts ──────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.user._id, isActive: true })
      .sort({ isDefault: -1, createdAt: 1 });
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

// ── GET /api/accounts/summary — totals + safe to spend ────────────────────
router.get('/summary', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const accounts = await Account.find({ userId, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

    const { getSpendingForPeriod } = require('../utils/spendCalculator');
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const spending = await getSpendingForPeriod(userId, start, end);
    const safeToSpend = totalBalance - spending.totalMoneyOut;

    res.json({
      success: true,
      data: {
        totalBalance,
        safeToSpend,
        spentThisMonth: spending.totalMoneyOut,
        hasAccounts: accounts.length > 0,
        accounts: accounts.map(a => ({
          _id:       a._id,
          name:      a.name,
          type:      a.type,
          balance:   a.balance,
          isDefault: a.isDefault,
          color:     a.color,
          icon:      a.icon,
        })),
      }
    });
  } catch (err) { next(err); }
});

// ── POST /api/accounts — create ───────────────────────────────────────────
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, type, balance, color, icon } = req.body;
    if (!name) return res.status(400).json({ message: 'Account name required' });

    const userId = req.user._id;
    const existingCount = await Account.countDocuments({ userId, isActive: true });
    const isDefault = existingCount === 0; // first account auto-becomes default

    const account = await Account.create({
      userId,
      name,
      type:      type  || 'bank_account',
      balance:   parseFloat(balance) || 0,
      color:     color || '#F5A623',
      icon:      icon  || 'bank',
      isDefault,
      balanceHistory: [{ balance: parseFloat(balance) || 0, recordedAt: new Date(), note: 'Opening balance' }],
    });

    if (isDefault) {
      await User.findByIdAndUpdate(userId, { defaultAccountId: account._id });
    }

    res.status(201).json({ success: true, data: account });
    safeEmit(req.user._id, 'accounts',   'created');
    safeEmit(req.user._id, 'dashboard',  'refresh');
  } catch (err) { next(err); }
});

// ── PATCH /api/accounts/:id/balance — update balance (salary received etc) ─
router.patch('/:id/balance', protect, async (req, res, next) => {
  try {
    const { balance, note } = req.body;
    if (balance === undefined || isNaN(balance))
      return res.status(400).json({ message: 'Valid balance required' });

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $set: { balance: parseFloat(balance), updatedAt: new Date() },
        $push: { balanceHistory: { balance: parseFloat(balance), recordedAt: new Date(), note: note || 'Balance updated' } },
      },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ success: true, data: account });
    safeEmit(req.user._id, 'accounts',   'balance_updated');
    safeEmit(req.user._id, 'dashboard',  'refresh');
  } catch (err) { next(err); }
});

// ── PATCH /api/accounts/:id/set-default ────────────────────────────────────
router.patch('/:id/set-default', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;
    await Account.updateMany({ userId }, { $set: { isDefault: false } });

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { isDefault: true } },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });

    await User.findByIdAndUpdate(userId, { defaultAccountId: account._id });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
});

// ── PUT /api/accounts/:id — update name/type/color/icon ──────────────────
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { name, type, color, icon } = req.body;
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { name, type, color, icon, updatedAt: new Date() } },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
});

// ── POST /api/accounts/transfer ────────────────────────────────────────────
router.post('/transfer', protect, async (req, res, next) => {
  try {
    const { fromId, toId: toIdStr, amount } = req.body;
    if (!fromId || !toIdStr || !amount || isNaN(amount))
      return res.status(400).json({ message: 'fromId, toId, and amount are required' });

    const userId = req.user._id;
    const amt = parseFloat(amount);
    const from = await Account.findOne({ _id: fromId, userId });
    const to   = await Account.findOne({ _id: toIdStr, userId });

    if (!from || !to) return res.status(404).json({ message: 'Account not found' });

    from.balance -= amt;
    from.balanceHistory.push({ balance: from.balance, recordedAt: new Date(), note: `Transfer to ${to.name}` });
    to.balance += amt;
    to.balanceHistory.push({ balance: to.balance, recordedAt: new Date(), note: `Transfer from ${from.name}` });

    await Promise.all([from.save(), to.save()]);
    res.json({ success: true, message: `₹${amt.toLocaleString('en-IN')} transferred from ${from.name} to ${to.name}` });
    safeEmit(req.user._id, 'accounts',  'balance_updated');
    safeEmit(req.user._id, 'dashboard', 'refresh');
  } catch (err) { next(err); }
});

// ── DELETE /api/accounts/:id — soft delete ─────────────────────────────────
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { isActive: false, isDefault: false, updatedAt: new Date() } },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });

    // If deleted account was default, promote the next one
    if (account.isDefault) {
      const next = await Account.findOne({ userId, isActive: true });
      if (next) {
        await Account.findByIdAndUpdate(next._id, { isDefault: true });
        await User.findByIdAndUpdate(userId, { defaultAccountId: next._id });
      } else {
        await User.findByIdAndUpdate(userId, { defaultAccountId: null });
      }
    }
    res.json({ success: true });
    safeEmit(req.user._id, 'accounts',  'deleted');
    safeEmit(req.user._id, 'dashboard', 'refresh');
  } catch (err) { next(err); }
});

// ── GET /api/accounts/net-worth-history ─────────────────────────────────
router.get('/net-worth-history', protect, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const accounts = await Account.find({ userId: req.user._id, isActive: true });
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      let netWorth = 0;
      accounts.forEach(a => {
        const snap = a.balanceHistory.filter(h => h.recordedAt <= endOfMonth).pop();
        netWorth += snap ? snap.balance : 0;
      });
      result.push({
        month: d.toLocaleString('default', { month: 'short' }),
        year:  d.getFullYear(),
        netWorth,
      });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;

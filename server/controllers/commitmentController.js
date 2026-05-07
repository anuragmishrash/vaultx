const Commitment = require('../models/Commitment');
const CommitmentLog = require('../models/CommitmentLog');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Account = require('../models/Account');
const mongoose = require('mongoose');
const { computeWaterfall } = require('../utils/waterfallEngine');
const { getCommitmentStatusForMonth } = require('../utils/commitmentHelpers');
const { predictFlexibleAmount, detectUnaddedCommitments, detectYoYDrift } = require('../utils/brainEngine');
const { invalidateAndRefresh } = require('../utils/zeroDayEngine');

// ─── CRUD ────────────────────────────────────────────────

const getCommitments = async (req, res, next) => {
  try {
    const commitments = await Commitment.find({ userId: req.user._id, isActive: true }).sort({ priority: 1, dueDay: 1 });
    res.json({ success: true, commitments });
  } catch (err) { next(err); }
};

const createCommitment = async (req, res, next) => {
  try {
    const c = await Commitment.create({ ...req.body, userId: req.user._id });
    res.status(201).json({ success: true, commitment: c });
  } catch (err) { next(err); }
};

const updateCommitment = async (req, res, next) => {
  try {
    const c = await Commitment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, commitment: c });
  } catch (err) { next(err); }
};

const deleteCommitment = async (req, res, next) => {
  try {
    await Commitment.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};

// Toggle pause for current month
const pauseCommitment = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.body.month || (now.getMonth() + 1);
    const year = req.body.year || now.getFullYear();

    const c = await Commitment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });

    const existingIdx = (c.pausedMonths || []).findIndex(p => p.month === month && p.year === year);
    if (existingIdx !== -1) {
      c.pausedMonths.splice(existingIdx, 1);
    } else {
      c.pausedMonths.push({ month, year });
    }
    await c.save();
    res.json({ success: true, commitment: c });
  } catch (err) { next(err); }
};

// ─── LOGS & CHECKLIST ────────────────────────────────────

const getLogs = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = parseInt(month) || now.getMonth() + 1;
    const y = parseInt(year) || now.getFullYear();

    const commitments = await Commitment.find({ userId: req.user._id, isActive: true });
    const logs = await CommitmentLog.find({ userId: req.user._id, month: m, year: y });

    // Every active (non-paused) commitment appears in checklist
    const checklist = [];
    for (const c of commitments) {
      const isPaused = (c.pausedMonths || []).some(pm => pm.month === m && pm.year === y);
      if (isPaused) continue;

      const log = logs.find(l => l.commitmentId?.toString() === c._id.toString()) || null;
      const statusInfo = getCommitmentStatusForMonth(c, log, m, y);

      // Prediction for flexible commitments
      let prediction = null;
      if (c.isFlexible) {
        prediction = await predictFlexibleAmount(c._id);
      }

      checklist.push({ commitment: c, log, statusInfo, prediction });
    }

    // Auto-suggest matching transactions (legacy simple matching)
    const txns = await Transaction.find({
      userId: req.user._id,
      date: { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59) },
    });
    const suggestions = {};
    checklist.forEach(item => {
      if (!item.log?.isPaid) {
        const match = txns.find(t =>
          t.title.toLowerCase().includes(item.commitment.title.toLowerCase()) ||
          item.commitment.title.toLowerCase().includes(t.title.toLowerCase())
        );
        if (match) suggestions[item.commitment._id] = match;
      }
    });

    res.json({ success: true, checklist, suggestions });
  } catch (err) { next(err); }
};

const mapCategory = (c) => {
  const map = {
    'Housing': 'Utilities',
    'Groceries': 'Food & Dining',
    'EMIs & Loans': 'Others',
    'Insurance': 'Others',
    'Family Support': 'Others',
    'Personal Growth': 'Education'
  };
  return map[c] || c;
};

const payCommitment = async (req, res, next) => {
  try {
    const { actualAmount, paidOn, linkedTransactionId, note } = req.body;
    const commitment = await Commitment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!commitment) return res.status(404).json({ success: false, message: 'Not found' });

    const now = new Date();
    const month = req.body.month || (now.getMonth() + 1);
    const year = req.body.year || now.getFullYear();

    const existingLog = await CommitmentLog.findOne({ userId: req.user._id, commitmentId: req.params.id, month, year });

    let finalTransactionId = linkedTransactionId || null;
    
    // Auto-create a transaction if marking paid without linking an existing one
    if (!finalTransactionId) {
      const newTx = await Transaction.create({
        userId: req.user._id,
        title: commitment.title,
        amount: actualAmount || commitment.amount,
        category: mapCategory(commitment.category) || 'Others',
        paymentMode: 'UPI', // Default
        date: paidOn || new Date(),
        isCommitmentPayment: true
      });
      finalTransactionId = newTx._id;
    }

    const log = await CommitmentLog.findOneAndUpdate(
      { userId: req.user._id, commitmentId: req.params.id, month, year },
      {
        isPaid: true,
        actualAmount: actualAmount || commitment.amount,
        paidOn: paidOn || new Date(),
        linkedTransactionId: finalTransactionId,
        variance: (actualAmount || commitment.amount) - commitment.amount,
        note: note || '',
      },
      { upsert: true, new: true }
    );

    const datesToInvalidate = [];

    // Reverse — if un-linking a transaction or changing the linked transaction
    if (existingLog && existingLog.linkedTransactionId && existingLog.linkedTransactionId.toString() !== (linkedTransactionId || '').toString()) {
      const oldTx = await Transaction.findByIdAndUpdate(existingLog.linkedTransactionId, {
        isCommitmentPayment: false
      });
      if (oldTx) datesToInvalidate.push(new Date(oldTx.date));
    }

    // Link new transaction
    if (finalTransactionId && (!existingLog || existingLog.linkedTransactionId?.toString() !== finalTransactionId.toString())) {
      const linked = await Transaction.findByIdAndUpdate(
        finalTransactionId,
        { isCommitmentPayment: true },
        { new: true }
      );
      if (linked) datesToInvalidate.push(new Date(linked.date));
    }

    if (datesToInvalidate.length > 0) {
      await invalidateAndRefresh(req.user._id, datesToInvalidate);
    }

    res.json({ success: true, log });
  } catch (err) { next(err); }
};

const getVariance = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const commitments = await Commitment.find({ userId: req.user._id, isActive: true, isFlexible: true });
    const result = [];
    for (const c of commitments) {
      const history = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const log = await CommitmentLog.findOne({
          userId: req.user._id, commitmentId: c._id,
          month: d.getMonth() + 1, year: d.getFullYear()
        });
        history.push({
          month: d.toLocaleString('default', { month: 'short' }),
          actual: log?.actualAmount || 0,
          expected: c.amount
        });
      }
      result.push({ commitment: c, history });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── WATERFALL ───────────────────────────────────────────

const getWaterfall = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id.toString());
    const month  = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year   = parseInt(req.query.year)  || new Date().getFullYear();

    // Get ALL active commitments
    const commitments = await Commitment.find({ userId, isActive: true });

    // Get logs for this month
    const logs = await CommitmentLog.find({ userId, month, year });

    // For each commitment, determine its status and actual paid amount
    const enriched = commitments.map(c => {
      const log = logs.find(l => l.commitmentId?.toString() === c._id.toString());
      return {
        ...c.toObject(),
        isPaid:       log?.isPaid || false,
        actualAmount: log?.isPaid ? (log.actualAmount || c.amount) : 0,
        paidOn:       log?.paidOn,
        statusInfo:   getCommitmentStatusForMonth(c, log, month, year),
      };
    });

    // Paid amount = sum of what was ACTUALLY PAID this month
    const totalPaid    = enriched.filter(c => c.isPaid).reduce((s, c) => s + c.actualAmount, 0);
    // Unpaid amount = sum of what is STILL OWED this month
    const totalUnpaid  = enriched.filter(c => !c.isPaid).reduce((s, c) => s + c.amount, 0);
    // Total expected = sum of all commitment amounts (what you OWE each month)
    const totalExpected = commitments.reduce((s, c) => s + c.amount, 0);

    // Account balance
    const accounts    = await Account.find({ userId, isActive: true });
    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

    // Variable spending this month (excluding commitment payments)
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);
    const varSpendResult = await Transaction.aggregate([
      { $match: {
        userId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        isCommitmentPayment: { $ne: true },
        isGuiltyFreeSpend:   { $ne: true },
        isATMWithdrawal:     { $ne: true },
      }},
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const variableSpending = varSpendResult[0]?.total || 0;

    const guiltyFreeResult = await Transaction.aggregate([
      { $match: { userId, date: { $gte: startOfMonth, $lte: endOfMonth }, isGuiltyFreeSpend: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const guiltyFreeUsed = guiltyFreeResult[0]?.total || 0;

    // New Mathematical Flow (Account-Balance Driven)
    const safeToSpend = totalBalance - totalUnpaid; // True free money after locking away unpaid bills
    const investableSurplus = safeToSpend - variableSpending - guiltyFreeUsed; 

    res.json({
      success: true,
      data: {
        month, year,
        waterfall: {
          totalBalance,
          totalUnpaid,
          safeToSpend,
          variableSpending,
          guiltyFreeUsed,
          investableSurplus
        },
        commitments: enriched
      }
    });
  } catch (err) { next(err); }
};

// ─── BRAIN: AFFORDABILITY (Feature 5) ───────────────────

const getAffordability = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const user = await User.findById(userId);
    const income = user.monthlySalary || 0;
    const commitments = await Commitment.find({ userId, isActive: true });
    const totalCommitments = commitments.reduce((s, c) => s + c.amount, 0);
    const commitmentRatio = income > 0 ? (totalCommitments / income) * 100 : 0;

    // Due date clustering (Feature 6)
    const logsThisMonth = await CommitmentLog.find({ userId, month, year });

    const dueClusters = {};
    for (const c of commitments) {
      const log = logsThisMonth.find(l => l.commitmentId.toString() === c._id.toString());
      if (log?.isPaid) continue; // Skip already paid commitments

      const day = c.dueDay;
      if (!dueClusters[day]) dueClusters[day] = [];
      dueClusters[day].push(c);
    }
    const clusterAlerts = Object.entries(dueClusters)
      .filter(([, cs]) => cs.length >= 2)
      .map(([day, cs]) => ({
        day: parseInt(day),
        totalAmount: cs.reduce((s, c) => s + c.amount, 0),
        commitments: cs.map(c => c.title),
      }));

    let status, message, color;
    if (commitmentRatio > 75) {
      status = 'critical'; color = '#FF5C5C';
      message = `Your fixed commitments are ${Math.round(commitmentRatio)}% of your income. Very little room for variable spending.`;
    } else if (commitmentRatio > 55) {
      status = 'warning'; color = '#F5A623';
      message = `Commitments are ${Math.round(commitmentRatio)}% of income. Watch your variable spending this month.`;
    } else {
      status = 'healthy'; color = '#00C9A7';
      message = `Looks healthy — commitments are ${Math.round(commitmentRatio)}% of income. You have good room to breathe.`;
    }

    res.json({
      success: true,
      data: {
        status, message, color,
        income, totalCommitments,
        commitmentRatio: Math.round(commitmentRatio),
        clusterAlerts,
      }
    });
  } catch (err) { next(err); }
};

// ─── BRAIN: SUGGESTIONS (Feature 4) ─────────────────────

const getSuggestions = async (req, res, next) => {
  try {
    const suggestions = await detectUnaddedCommitments(req.user._id);
    res.json({ success: true, data: suggestions });
  } catch (err) { next(err); }
};

const acceptSuggestion = async (req, res, next) => {
  try {
    const { title, avgAmount, isVariable, category } = req.body;
    const commitment = await Commitment.create({
      userId: req.user._id,
      title,
      amount: avgAmount,
      isFlexible: isVariable || false,
      category: category || 'Others',
      isActive: true,
      dueDay: 5,
      priority: 'important',
    });
    res.status(201).json({ success: true, commitment });
  } catch (err) { next(err); }
};

// ─── BRAIN: PREDICTION (Feature 2) ──────────────────────

const getPrediction = async (req, res, next) => {
  try {
    const commitment = await Commitment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!commitment) return res.status(404).json({ message: 'Not found' });
    if (!commitment.isFlexible) return res.json({ success: true, data: null });
    const prediction = await predictFlexibleAmount(commitment._id);
    res.json({ success: true, data: prediction });
  } catch (err) { next(err); }
};

module.exports = {
  getCommitments, createCommitment, updateCommitment, deleteCommitment,
  pauseCommitment, getLogs, payCommitment, getVariance, getWaterfall,
  getAffordability, getSuggestions, acceptSuggestion, getPrediction,
};

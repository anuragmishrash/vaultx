const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const TransactionPattern = require('../models/TransactionPattern');
const Transaction = require('../models/Transaction');
const CategoryMemory = require('../models/CategoryMemory');
const { getTransactionSuggestions, getGuiltFreeSuggestions, getCommitmentSuggestions } = require('../utils/patternEngine');

// ─── Existing suggestion endpoints ──────────────────────────────
router.get('/suggestions/transactions', protect, async (req, res) => {
  try {
    const suggestions = await getTransactionSuggestions(req.user._id);
    res.json({ success: true, data: suggestions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/suggestions/guilt-free', protect, async (req, res) => {
  try {
    const suggestions = await getGuiltFreeSuggestions(req.user._id);
    res.json({ success: true, data: suggestions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/suggestions/commitments', protect, async (req, res) => {
  try {
    const suggestions = await getCommitmentSuggestions(req.user._id);
    res.json({ success: true, data: suggestions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Batch Daily Add ────────────────────────────────────────────
router.get('/batch', protect, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user._id.toString());
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const patterns = await TransactionPattern.find({
      userId: uid, isActive: true,
      frequency: { $in: ['daily', 'alternate_days'] },
      confidence: { $gte: 55 }, occurrences: { $gte: 3 },
    }).sort({ confidence: -1 }).lean();

    const items = [];
    for (const p of patterns) {
      if (p.suggestionDismissedCount >= 5) continue;
      const already = await Transaction.countDocuments({
        userId: uid, normalizedTitle: p.normalizedTitle,
        date: { $gte: todayStart, $lte: todayEnd },
      });
      if (already > 0) continue;
      items.push({
        patternId: p._id, title: p.title, amount: p.amount,
        category: p.category, paymentMode: p.paymentMode || 'UPI',
        frequency: p.frequency,
      });
    }

    res.json({ success: true, data: { transactionItems: items, totalAmount: items.reduce((s, i) => s + i.amount, 0) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/batch-confirm', protect, async (req, res) => {
  try {
    const { patternIds = [], amounts = {} } = req.body;
    const created = [];

    for (const pid of patternIds) {
      const pattern = await TransactionPattern.findById(pid);
      if (!pattern) continue;
      const amount = amounts[pid] || pattern.amount;
      const tx = new Transaction({
        userId: req.user._id, title: pattern.title,
        normalizedTitle: pattern.normalizedTitle, amount,
        category: pattern.category, paymentMode: pattern.paymentMode || 'UPI',
        date: new Date(), regretStatus: 'pending',
        isGuiltyFreeSpend: pattern.suggestionType === 'guilt_free',
        note: 'Added via batch daily',
      });
      await tx.save();
      created.push(tx);

      // Update memory
      const nTitle = tx.normalizedTitle;
      if (nTitle && nTitle.length >= 2) {
        await CategoryMemory.findOneAndUpdate(
          { userId: req.user._id, normalizedTitle: nTitle },
          { $set: { displayTitle: tx.title, category: tx.category, paymentMode: tx.paymentMode, typicalAmount: tx.amount, lastUsedAt: new Date() }, $inc: { timesUsed: 1 } },
          { upsert: true }
        );
      }
    }

    try { const { invalidateAndRefresh } = require('../utils/zeroDayEngine'); await invalidateAndRefresh(req.user._id, [new Date()]); } catch (_) {}

    res.json({ success: true, data: created });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Quick Templates ────────────────────────────────────────────
router.get('/templates', protect, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user._id.toString());
    const patterns = await TransactionPattern.find({
      userId: uid, isActive: true, occurrences: { $gte: 2 },
    }).sort({ occurrences: -1, confidence: -1 }).limit(5).lean();

    res.json({
      success: true,
      data: patterns.map(p => ({
        _id: p._id, title: p.title, amount: p.amount,
        category: p.category, paymentMode: p.paymentMode || 'UPI',
        frequency: p.frequency, isPinned: p.occurrences >= 5,
      })),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Category Memory search ─────────────────────────────────────
router.get('/memory', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ success: true, data: [] });
    const uid = new mongoose.Types.ObjectId(req.user._id.toString());
    const escaped = q.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const results = await CategoryMemory.find({
      userId: uid,
      normalizedTitle: { $regex: `^${escaped}`, $options: 'i' },
    }).sort({ timesUsed: -1, lastUsedAt: -1 }).limit(5).lean();
    res.json({ success: true, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Confirm / Dismiss single suggestion ────────────────────────
router.post('/confirm/:patternId', protect, async (req, res) => {
  try {
    const pattern = await TransactionPattern.findById(req.params.patternId);
    if (!pattern) return res.status(404).json({ success: false, message: 'Pattern not found' });

    const transaction = new Transaction({
      userId: req.user._id, title: pattern.title,
      normalizedTitle: pattern.normalizedTitle,
      amount: req.body.amount || pattern.amount,
      category: pattern.category, paymentMode: pattern.paymentMode || 'UPI',
      date: new Date(),
      isGuiltyFreeSpend: pattern.suggestionType === 'guilt_free',
      isCommitmentPayment: pattern.suggestionType === 'commitment',
      note: 'Added via smart suggestion',
      regretStatus: 'pending',
    });
    if (transaction.isCommitmentPayment || transaction.isGuiltyFreeSpend) {
      transaction.regretStatus = undefined;
    }
    await transaction.save();
    res.json({ success: true, data: transaction });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/dismiss/:patternId', protect, async (req, res) => {
  try {
    await TransactionPattern.findByIdAndUpdate(req.params.patternId, { $inc: { suggestionDismissedCount: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;

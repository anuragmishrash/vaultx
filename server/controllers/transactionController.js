const Transaction = require('../models/Transaction');
const { Parser } = require('json2csv');
const { findMatchingCommitment } = require('../utils/brainEngine');
const { invalidateAndRefresh } = require('../utils/zeroDayEngine');

const getTransactions = async (req, res, next) => {
  try {
    const {
      category, startDate, endDate, regret, search, paymentMode,
      minAmount, maxAmount, page = 1, limit = 50, sort = 'date', order = 'desc',
      isCashSpend, month, year,
    } = req.query;

    const query = { userId: req.user._id };
    if (category) query.category = category;
    if (paymentMode) query.paymentMode = paymentMode;
    if (regret) query.regretStatus = regret;
    if (isCashSpend === 'true') query.isCashSpend = true;
    if (req.query.isGuiltyFreeSpend === 'true') query.isGuiltyFreeSpend = true;
    if (month && year) {
      const m = parseInt(month), y = parseInt(year);
      query.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59, 999) };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate + 'T00:00:00.000Z');
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj = { [sort]: order === 'desc' ? -1 : 1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query).sort(sortObj).skip(skip).limit(parseInt(limit));

    res.json({
      success: true,
      transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const data = { ...req.body, userId: req.user._id };
    
    // Fix: Parse as local time noon to avoid UTC timezone boundary issues
    if (data.date) {
      // if it's just "YYYY-MM-DD", append T12:00:00 to treat it as local noon
      const dateStr = data.date.includes('T') ? data.date : `${data.date}T12:00:00`;
      data.date = new Date(dateStr);
    } else {
      data.date = new Date();
    }

    // Auto-set isCashSpend
    if (data.paymentMode === 'Cash') data.isCashSpend = true;
    if (data.paymentMode === 'ATM Withdrawal') {
      data.isATMWithdrawal = true;
      data.isCashSpend = false; // ATM withdrawal is not a spend, it's a transfer to cash
      data.category = 'Others';
    }
    if (data.isGuiltyFreeSpend) {
      data.category = 'Guilt-Free';
      data.regretStatus = 'worth_it';
    }
    const transaction = await Transaction.create(data);

    // Auto-update cash envelope on ATM withdrawal
    if (transaction.isATMWithdrawal) {
      const CashEnvelope = require('../models/CashEnvelope');
      const txDate = new Date(transaction.date);
      const month = txDate.getMonth() + 1;
      const year = txDate.getFullYear();
      const env = await CashEnvelope.findOneAndUpdate(
        { userId: req.user._id, month, year },
        { $inc: { totalWithdrawn: transaction.amount, currentBalance: transaction.amount } },
        { upsert: false, new: true }
      );
    }

    // If recurring, create/update subscription
    if (transaction.isRecurring && transaction.recurringLabel) {
      const Subscription = require('../models/Subscription');
      const existing = await Subscription.findOne({ userId: req.user._id, name: transaction.recurringLabel });
      if (!existing) {
        const nextDue = new Date(transaction.date);
        nextDue.setMonth(nextDue.getMonth() + 1);
        await Subscription.create({
          userId: req.user._id,
          name: transaction.recurringLabel,
          amount: transaction.amount,
          billingCycle: 'monthly',
          nextDueDate: nextDue,
          category: transaction.category,
          lastCharged: transaction.date,
        });
      }
    }

    // Brain: find matching unpaid commitment
    let commitmentMatch = null;
    try {
      const match = await findMatchingCommitment(transaction, req.user._id);
      if (match) {
        commitmentMatch = {
          commitmentId: match.commitment._id,
          commitmentTitle: match.commitment.title,
          commitmentAmount: match.commitment.amount,
          logId: match.log._id,
          score: match.score,
        };
      }
    } catch (e) {
      // Non-fatal — never block the response
    }

    await invalidateAndRefresh(req.user._id, [new Date(transaction.date)]);

    // Save to CategoryMemory for auto-fill
    try {
      const CategoryMemory = require('../models/CategoryMemory');
      const nTitle = transaction.normalizedTitle || transaction.title?.toLowerCase().trim();
      if (nTitle && nTitle.length >= 2) {
        await CategoryMemory.findOneAndUpdate(
          { userId: req.user._id, normalizedTitle: nTitle },
          {
            $set: {
              displayTitle: transaction.title,
              category: transaction.category,
              paymentMode: transaction.paymentMode,
              typicalAmount: transaction.amount,
              lastUsedAt: new Date(),
            },
            $inc: { timesUsed: 1 },
          },
          { upsert: true }
        );
      }
    } catch (_) { /* non-fatal */ }

    res.status(201).json({ success: true, transaction, commitmentMatch });
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const existing = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ success: false, message: 'Transaction not found' });
    const originalDate = new Date(existing.date);

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    
    const datesToInvalidate = [new Date(transaction.date)];
    if (originalDate.toDateString() !== new Date(transaction.date).toDateString()) {
      datesToInvalidate.push(originalDate);
    }
    await invalidateAndRefresh(req.user._id, datesToInvalidate);

    res.json({ success: true, transaction });
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    
    await invalidateAndRefresh(req.user._id, [new Date(transaction.date)]);
    
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

const bulkDeleteTransactions = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await Transaction.deleteMany({ _id: { $in: ids }, userId: req.user._id });
    res.json({ success: true, message: `${ids.length} transactions deleted` });
  } catch (err) {
    next(err);
  }
};

const rateRegret = async (req, res, next) => {
  try {
    const { rating } = req.body;
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    if (transaction.isCommitmentPayment) {
      return res.status(400).json({ success: false, message: 'Commitment payments cannot be rated.' });
    }
    if (transaction.isGuiltyFreeSpend) {
      return res.status(400).json({ success: false, message: 'Guilt-free spends cannot be rated.' });
    }

    transaction.regretStatus = rating;
    transaction.regretRatedAt = new Date();
    await transaction.save();

    res.json({ success: true, transaction });
  } catch (err) {
    next(err);
  }
};

const exportCSV = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id }).sort({ date: -1 });
    const fields = ['title', 'amount', 'category', 'paymentMode', 'date', 'regretStatus', 'note', 'timeCostHours', 'futureValueAt5Yr'];
    const parser = new Parser({ fields });
    const csv = parser.parse(transactions.map(t => t.toObject()));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vault-transactions.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction, bulkDeleteTransactions, rateRegret, exportCSV };

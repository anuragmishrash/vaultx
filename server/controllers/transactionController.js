const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const User = require('../models/User');
const { Parser } = require('json2csv');
const { findMatchingCommitment } = require('../utils/brainEngine');
const { invalidateAndRefresh } = require('../utils/zeroDayEngine');
const { parseDateParams, getSpendingForPeriod } = require('../utils/spendCalculator');

// ── helper: deduct from account after a spend ────────────────────────────────
async function deductFromAccount(accountId, userId, amount, note) {
  if (!accountId) return;
  await Account.findOneAndUpdate(
    { _id: accountId, userId },
    {
      $inc: { balance: -amount },
      $push: { balanceHistory: { balance: 0, recordedAt: new Date(), note } },
    },
    { new: true }
  ).then(async acc => {
    if (acc) {
      // Update the placeholder history entry with the real new balance
      const last = acc.balanceHistory.length - 1;
      acc.balanceHistory[last].balance = acc.balance;
      await acc.save();
    }
  }).catch(() => {}); // non-fatal
}

// ── helper: restore to account when transaction deleted / changed ────────────
async function restoreToAccount(accountId, userId, amount, note) {
  if (!accountId) return;
  await Account.findOneAndUpdate(
    { _id: accountId, userId },
    {
      $inc: { balance: +amount },
      $push: { balanceHistory: { balance: 0, recordedAt: new Date(), note } },
    },
    { new: true }
  ).then(async acc => {
    if (acc) {
      const last = acc.balanceHistory.length - 1;
      acc.balanceHistory[last].balance = acc.balance;
      await acc.save();
    }
  }).catch(() => {});
}

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

    // ── Date filter — always use LOCAL-time boundaries to avoid UTC day-shift bug ──
    let periodStart = null, periodEnd = null;
    if (month && year) {
      const m = parseInt(month), y = parseInt(year);
      periodStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
      periodEnd   = new Date(y, m, 0, 23, 59, 59, 999);
      query.date  = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate || endDate) {
      const bounds = parseDateParams({ startDate, endDate });
      periodStart  = bounds.start || null;
      periodEnd    = bounds.end   || null;
      query.date   = {};
      if (periodStart) query.date.$gte = periodStart;
      if (periodEnd)   query.date.$lte = periodEnd;
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { note:  { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj    = { [sort]: order === 'desc' ? -1 : 1 };
    const skip       = (parseInt(page) - 1) * parseInt(limit);
    const total      = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query).sort(sortObj).skip(skip).limit(parseInt(limit));

    // ── Spending summary per user prompt ────────────────────────────────────
    const regularTransactions = transactions.filter(t =>
      !t.isCommitmentPayment && !t.isGuiltyFreeSpend && !t.isATMWithdrawal
    );
    const billTransactions     = transactions.filter(t => t.isCommitmentPayment);
    const guiltFreeTransactions = transactions.filter(t => t.isGuiltyFreeSpend);

    const summary = {
      totalCount:      transactions.length,
      regularCount:    regularTransactions.length,
      billsCount:      billTransactions.length,
      guiltFreeCount:  guiltFreeTransactions.length,

      variableTotal:   regularTransactions.reduce((s, t) => s + t.amount, 0),
      billsPaidTotal:  billTransactions.reduce((s, t) => s + t.amount, 0),
      guiltyFreeTotal: guiltFreeTransactions.reduce((s, t) => s + t.amount, 0),

      grandTotal:      transactions.reduce((s, t) => s + t.amount, 0),
    };

    res.json({
      success: true,
      transactions,
      summary,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const data = { ...req.body, userId: req.user._id };

    // Parse date as local noon to avoid UTC boundary issues
    if (data.date) {
      const dateStr = data.date.includes('T') ? data.date : `${data.date}T12:00:00`;
      data.date = new Date(dateStr);
    } else {
      data.date = new Date();
    }

    // Auto-set cash/ATM flags
    if (data.paymentMode === 'Cash') data.isCashSpend = true;
    if (data.paymentMode === 'ATM Withdrawal') {
      data.isATMWithdrawal = true;
      data.isCashSpend = false;
      data.category = 'Others';
    }
    if (data.isGuiltyFreeSpend) {
      data.category = 'Guilt-Free';
      data.regretStatus = 'worth_it';
    }

    // Resolve accountId — use body value or fall back to user's default
    let accountId = data.accountId || null;
    if (!accountId) {
      const user = await User.findById(req.user._id).select('defaultAccountId');
      accountId = user?.defaultAccountId || null;
    }
    data.accountId = accountId;

    const transaction = await Transaction.create(data);

    // AUTO-DEDUCT from the linked account (applies to all types including credit_card)
    if (accountId && !transaction.isATMWithdrawal) {
      await deductFromAccount(
        accountId,
        req.user._id,
        transaction.amount,
        `Spent: ${transaction.title}`
      );
    }

    // ATM withdrawal: top up the cash envelope
    if (transaction.isATMWithdrawal) {
      const CashEnvelope = require('../models/CashEnvelope');
      const txDate = new Date(transaction.date);
      await CashEnvelope.findOneAndUpdate(
        { userId: req.user._id, month: txDate.getMonth() + 1, year: txDate.getFullYear() },
        { $inc: { totalWithdrawn: transaction.amount, currentBalance: transaction.amount } },
        { upsert: false }
      );
      // ATM withdrawal also deducts from bank account
      if (accountId) {
        await deductFromAccount(accountId, req.user._id, transaction.amount, `ATM Withdrawal`);
      }
    }

    // Recurring subscription tracking
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
          commitmentId:     match.commitment._id,
          commitmentTitle:  match.commitment.title,
          commitmentAmount: match.commitment.amount,
          logId:            match.log._id,
          score:            match.score,
        };
      }
    } catch (e) { /* non-fatal */ }

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
              displayTitle:  transaction.title,
              category:      transaction.category,
              paymentMode:   transaction.paymentMode,
              typicalAmount: transaction.amount,
              lastUsedAt:    new Date(),
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

    const originalDate      = new Date(existing.date);
    const oldAmount         = existing.amount;
    const oldAccountId      = existing.accountId?.toString() || null;
    const newAmount         = req.body.amount !== undefined ? parseFloat(req.body.amount) : oldAmount;
    const newAccountId      = req.body.accountId || oldAccountId;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    // ── Account balance reconciliation ──────────────────────────────────────
    if (oldAccountId && oldAccountId === newAccountId) {
      // Same account — adjust for amount difference
      const diff = newAmount - oldAmount;
      if (diff !== 0) {
        await Account.findOneAndUpdate(
          { _id: oldAccountId, userId: req.user._id },
          { $inc: { balance: -diff } }
        );
      }
    } else {
      // Account changed — restore to old, deduct from new
      if (oldAccountId) {
        await restoreToAccount(oldAccountId, req.user._id, oldAmount, `Edited transaction: ${existing.title}`);
      }
      if (newAccountId) {
        await deductFromAccount(newAccountId, req.user._id, newAmount, `Edited transaction: ${transaction.title}`);
      }
    }

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
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const { amount, accountId, title } = transaction;
    await transaction.deleteOne();

    // Restore balance to the linked account
    if (accountId) {
      await restoreToAccount(accountId, req.user._id, amount, `Deleted: ${title}`);
    }

    await invalidateAndRefresh(req.user._id, [new Date(transaction.date)]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

const bulkDeleteTransactions = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const txns = await Transaction.find({ _id: { $in: ids }, userId: req.user._id });

    // Restore each transaction's amount to its linked account
    for (const t of txns) {
      if (t.accountId) {
        await restoreToAccount(t.accountId, req.user._id, t.amount, `Bulk delete: ${t.title}`);
      }
    }

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

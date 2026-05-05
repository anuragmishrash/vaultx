const IncomeEntry = require('../models/IncomeEntry');

/**
 * GET /api/income?month=2026-05
 * Returns all income entries for the given month and their total.
 */
const getIncome = async (req, res, next) => {
  try {
    const { month } = req.query; // e.g. "2026-05"
    if (!month) return res.status(400).json({ success: false, message: 'month query param required (YYYY-MM)' });

    const entries = await IncomeEntry.find({ userId: req.user._id, month }).sort({ date: 1 });
    const total = entries.reduce((sum, e) => sum + e.amount, 0);

    res.json({ success: true, total, entries });
  } catch (err) { next(err); }
};

/**
 * POST /api/income
 * Body: { amount, date, note }
 * Logs an income entry for the current or specified month.
 */
const logIncome = async (req, res, next) => {
  try {
    const { amount, date, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'amount must be positive' });

    const entryDate = date ? new Date(date) : new Date();
    const month = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

    const entry = await IncomeEntry.create({
      userId: req.user._id,
      amount,
      date: entryDate,
      month,
      note: note || '',
    });

    res.status(201).json({ success: true, entry });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/income/:id
 * Removes an income entry.
 */
const deleteIncome = async (req, res, next) => {
  try {
    const entry = await IncomeEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { getIncome, logIncome, deleteIncome };

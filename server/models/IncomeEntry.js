const mongoose = require('mongoose');

const incomeEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, default: Date.now },
  // month in "YYYY-MM" format e.g. "2026-05" — for fast monthly lookup
  month: { type: String, required: true },
  note: { type: String, trim: true, default: '' },
}, { timestamps: true });

incomeEntrySchema.index({ userId: 1, month: 1 });

module.exports = mongoose.model('IncomeEntry', incomeEntrySchema);

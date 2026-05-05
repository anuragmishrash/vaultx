const mongoose = require('mongoose');

const commitmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    enum: ['Housing', 'Utilities', 'Health & Fitness', 'Groceries',
           'Personal Care', 'Family Support', 'EMIs & Loans',
           'Education', 'Transport', 'Insurance', 'Personal Growth'],
    required: true
  },
  dueDay: { type: Number, min: 1, max: 31, default: 1 },
  isFlexible: { type: Boolean, default: false },
  flexibleRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
  priority: { type: String, enum: ['critical', 'important', 'optional'], default: 'important' },
  note: { type: String, trim: true, default: '' },
  pausedMonths: [{ month: Number, year: Number }],
}, { timestamps: true });

module.exports = mongoose.model('Commitment', commitmentSchema);

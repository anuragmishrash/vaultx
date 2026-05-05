const mongoose = require('mongoose');

const transactionPatternSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  normalizedTitle: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  category: { type: String },
  paymentMode: { type: String },
  frequency: { type: String, enum: ['daily', 'alternate_days', 'weekly', 'monthly', 'custom'] },
  confidence: { type: Number, default: 0 },
  occurrences: { type: Number, default: 0 },
  nextExpectedDate: { type: Date },
  suggestionType: {
    type: String,
    enum: ['transaction', 'guilt_free', 'commitment'],
    default: 'transaction',
  },
  suggestionDismissedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('TransactionPattern', transactionPatternSchema);

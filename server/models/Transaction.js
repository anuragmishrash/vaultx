const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  normalizedTitle: { type: String },
  amount: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    enum: ['Food & Dining', 'Shopping', 'Transport', 'Entertainment',
           'Utilities', 'Health & Fitness', 'Travel', 'Education',
           'Personal Care', 'Investments', 'Guilt-Free', 'Others'],
    default: 'Others'
  },
  paymentMode: { type: String, enum: ['UPI', 'Card', 'Cash', 'Net Banking', 'ATM Withdrawal'], default: 'UPI' },
  note: { type: String, trim: true, default: '' },
  date: { type: Date, default: Date.now, index: true },
  isRecurring: { type: Boolean, default: false },
  recurringLabel: { type: String, default: '' },
  moodAtTime: { type: String, default: null },
  regretStatus: {
    type: String,
    enum: ['pending', 'worth_it', 'okay', 'regret'],
    default: 'pending'
  },
  regretRatedAt: { type: Date, default: null },
  timeCostHours: { type: Number, default: 0 },
  futureValueAt5Yr: { type: Number, default: 0 },
  futureValueAt10Yr: { type: Number, default: 0 },
  isGuiltyFreeSpend: { type: Boolean, default: false },
  isCommitmentPayment: { type: Boolean, default: false },
  isCashSpend: { type: Boolean, default: false },
  isATMWithdrawal: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

// Auto-compute time cost and future values before save
transactionSchema.pre('save', async function(next) {
  if (this.title) {
    this.normalizedTitle = this.title.toLowerCase().trim();
  }

  if (this.isModified('amount') || this.isNew) {
    const User = require('./User');
    const fvHelpers = require('../utils/futureValueHelpers');
    const timeHelpers = require('../utils/timeCostHelpers');

    const user = await User.findById(this.userId);
    if (user && user.monthlySalary > 0) {
      this.timeCostHours = timeHelpers.calcTimeCostHours(this.amount, user.monthlySalary);
    } else {
      this.timeCostHours = null;
    }
    this.futureValueAt5Yr = fvHelpers.calcFutureValue(this.amount, 12, 5);
    this.futureValueAt10Yr = fvHelpers.calcFutureValue(this.amount, 12, 10);
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);

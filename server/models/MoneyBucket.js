const mongoose = require('mongoose');

const balanceHistorySchema = new mongoose.Schema({
  balance: { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: false });

const moneyBucketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['bank_account', 'cash', 'upi_wallet', 'other'],
    default: 'bank_account',
  },
  balance: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now },
  balanceHistory: [balanceHistorySchema],
}, { timestamps: true });

module.exports = mongoose.model('MoneyBucket', moneyBucketSchema);

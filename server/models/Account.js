const mongoose = require('mongoose');

const ACCOUNT_COLORS = ['#F5A623', '#00C9A7', '#4E9FFF', '#8B7CF6', '#FF5C5C', '#F06292'];

const balanceHistorySchema = new mongoose.Schema({
  balance:    { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now },
  note:       { type: String, default: '' },
}, { _id: false });

const accountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name:  { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['bank_account', 'cash', 'upi_wallet', 'credit_card', 'other'],
    default: 'bank_account',
  },
  balance:   { type: Number, required: true, default: 0 },
  isDefault: { type: Boolean, default: false },
  isActive:  { type: Boolean, default: true },
  balanceHistory: [balanceHistorySchema],
  currency: { type: String, default: 'INR' },
  color:    { type: String, default: '#F5A623' },
  icon:     { type: String, default: 'bank' },
}, { timestamps: true });

accountSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.model('Account', accountSchema);
module.exports.ACCOUNT_COLORS = ACCOUNT_COLORS;

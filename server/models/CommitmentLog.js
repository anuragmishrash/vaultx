const mongoose = require('mongoose');

const commitmentLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  commitmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commitment', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
  actualAmount: { type: Number, default: 0 },
  paidOn: { type: Date, default: null },
  linkedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  variance: { type: Number, default: 0 },
  note: { type: String, trim: true, default: '' },
  autoRolledOver: { type: Boolean, default: false },
}, { timestamps: true });

commitmentLogSchema.index({ userId: 1, commitmentId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('CommitmentLog', commitmentLogSchema);

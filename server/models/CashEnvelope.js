const mongoose = require('mongoose');

const cashEnvelopeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  totalLogged: { type: Number, default: 0 },
  untrackedAmount: { type: Number, default: 0 },
  lastPhysicalCount: { type: Number, default: null },
  lastCountedAt: { type: Date, default: null },
}, { timestamps: true });

cashEnvelopeSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('CashEnvelope', cashEnvelopeSchema);

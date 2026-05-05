const mongoose = require('mongoose');

const zeroDayLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true },
  wasZeroDay: { type: Boolean, default: false },
  totalSpent: { type: Number, default: 0 },
}, { timestamps: true });

zeroDayLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ZeroDayLog', zeroDayLogSchema);

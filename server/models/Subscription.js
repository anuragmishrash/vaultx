const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  billingCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
  nextDueDate: { type: Date },
  category: { type: String, default: 'Entertainment' },
  isActive: { type: Boolean, default: true },
  autoDetected: { type: Boolean, default: false },
  lastCharged: { type: Date, default: null },
  logo: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  monthlySalary: { type: Number, default: 0 },
  monthlyBudget: { type: Number, default: 0 },
  guiltyFreeAllowance: { type: Number, default: 1500 },
  guiltyFreeRollover: { type: Boolean, default: false },
  currency: { type: String, default: 'INR' },
  theme: { type: String, default: 'dark' },
  spendDNAType: { type: String, default: null },
  spendDNALastUpdated: { type: Date, default: null },
  zeroDayStreak: { type: Number, default: 0 },
  zeroDayPersonalBest: { type: Number, default: 0 },
  lastZeroDay: { type: Date, default: null },
  refreshToken: { type: String, default: null },
  notifications: {
    regretReminders: { type: Boolean, default: true },
    subscriptionAlerts: { type: Boolean, default: true },
    weeklyDNAReport: { type: Boolean, default: true },
    zeroDayAlerts: { type: Boolean, default: true },
    commitmentReminders: { type: Boolean, default: true },
  },
  commitmentCarryForward: { type: Boolean, default: false },
  // Feature: My Money Mode
  moneyMode: { type: String, enum: ['salary', 'pool', 'wallet'], default: 'salary' },
  spendingPool: { type: Number, default: null },
  spendingPoolMonth: { type: Number, default: null },
  spendingPoolYear: { type: Number, default: null },
  hideWalletBalance: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

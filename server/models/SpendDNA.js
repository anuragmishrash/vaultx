const mongoose = require('mongoose');

const spendDNASchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  snapshot: {
    comfort: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    impulse: { type: Number, default: 0 },
    discipline: { type: Number, default: 0 },
  },
  dominantType: { type: String, default: null },
  meetsMinimum: { type: Boolean, default: false },
  transactionCount: { type: Number, default: 0 },
  daysActive: { type: Number, default: 0 },
  categoriesUsed: { type: Number, default: 0 },
  computedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SpendDNA', spendDNASchema);

const mongoose = require('mongoose');

const categoryMemorySchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  normalizedTitle: { type: String, required: true },
  displayTitle:    { type: String },
  category:        { type: String },
  paymentMode:     { type: String },
  typicalAmount:   { type: Number },
  timesUsed:       { type: Number, default: 1 },
  lastUsedAt:      { type: Date, default: Date.now },
});

categoryMemorySchema.index({ userId: 1, normalizedTitle: 1 }, { unique: true });

module.exports = mongoose.model('CategoryMemory', categoryMemorySchema);

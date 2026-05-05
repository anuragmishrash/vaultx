const mongoose = require('mongoose');

const moodLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mood: {
    type: String,
    enum: ['great', 'good', 'neutral', 'stressed', 'sad', 'angry'],
    required: true
  },
  moodScore: { type: Number, min: 1, max: 5, required: true },
  note: { type: String, trim: true, default: '' },
  date: { type: Date, default: Date.now },
  totalSpentSameDay: { type: Number, default: 0 },
}, { timestamps: true });

// Unique mood per user per day
moodLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('MoodLog', moodLogSchema);

const MoodLog = require('../models/MoodLog');
const Transaction = require('../models/Transaction');
const { safeEmit } = require('../socket');

const MOOD_SCORES = { great: 5, good: 4, neutral: 3, stressed: 2, sad: 1, angry: 1 };

const logMood = async (req, res, next) => {
  try {
    const { mood, note } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const existing = await MoodLog.findOne({ userId: req.user._id, date: { $gte: startOfDay, $lte: endOfDay } });
    if (existing) return res.status(400).json({ success: false, message: 'Mood already logged today' });

    // Get total spent today
    const todayTransactions = await Transaction.find({
      userId: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    const totalSpentSameDay = todayTransactions.reduce((s, t) => s + t.amount, 0);

    const log = await MoodLog.create({
      userId: req.user._id,
      mood,
      moodScore: MOOD_SCORES[mood] || 3,
      note,
      date: new Date(),
      totalSpentSameDay,
    });

    res.status(201).json({ success: true, log });
    safeEmit(req.user._id, 'mood', 'logged');
  } catch (err) {
    next(err);
  }
};

const getMoods = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const query = { userId: req.user._id };
    if (year && month) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }
    const moods = await MoodLog.find(query).sort({ date: 1 });
    res.json({ success: true, moods });
  } catch (err) {
    next(err);
  }
};

const getCorrelation = async (req, res, next) => {
  try {
    const moods = await MoodLog.find({ userId: req.user._id }).sort({ date: 1 });
    if (moods.length < 7) {
      return res.json({ success: true, hasData: false, message: 'Log at least 7 days of mood to see correlation' });
    }

    const moodAverages = { great: [], good: [], neutral: [], stressed: [], sad: [], angry: [] };
    moods.forEach(m => {
      if (moodAverages[m.mood]) moodAverages[m.mood].push(m.totalSpentSameDay);
    });

    const avgByMood = {};
    for (const [mood, amounts] of Object.entries(moodAverages)) {
      if (amounts.length > 0) {
        avgByMood[mood] = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
      }
    }

    // Simple linear correlation
    const n = moods.length;
    const sumX = moods.reduce((s, m) => s + m.moodScore, 0);
    const sumY = moods.reduce((s, m) => s + m.totalSpentSameDay, 0);
    const sumXY = moods.reduce((s, m) => s + m.moodScore * m.totalSpentSameDay, 0);
    const sumX2 = moods.reduce((s, m) => s + m.moodScore ** 2, 0);
    const sumY2 = moods.reduce((s, m) => s + m.totalSpentSameDay ** 2, 0);
    const r = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2)) || 0;

    const triggerMood = Object.entries(avgByMood).reduce((a, b) => a[1] > b[1] ? a : b)?.[0] || 'stressed';

    res.json({
      success: true,
      hasData: true,
      correlation: parseFloat(r.toFixed(3)),
      avgByMood,
      triggerMood,
      dataPoints: moods.map(m => ({ date: m.date, moodScore: m.moodScore, spent: m.totalSpentSameDay, mood: m.mood })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { logMood, getMoods, getCorrelation };

const User = require('../models/User');
const { getMonthZeroDays, refreshUserStreak } = require('../utils/zeroDayEngine');

function getLevel(streak) {
  if (streak >= 15) return 'Vault Master';
  if (streak >= 8)  return 'Iron Will';
  if (streak >= 4)  return 'Committed';
  return 'Beginner';
}

function getNextLevelThreshold(streak) {
  if (streak >= 15) return null;      // already max level
  if (streak >= 8)  return 15;
  if (streak >= 4)  return 8;
  return 4;
}

const getZeroDays = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();

    const calendarData = await getMonthZeroDays(req.user._id, month, year);

    // Count zero days this month (only past/today days)
    const zeroDayCount = Object.values(calendarData).filter(v => v === true).length;

    res.json({
      success: true,
      data: { month, year, calendar: calendarData, zeroDayCount }
    });
  } catch (err) { next(err); }
};

const getStreak = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Recalculate fresh (don't trust cached value if it might be stale)
    const { streak, personalBest } = await refreshUserStreak(req.user._id);

    res.json({
      success: true,
      data: {
        currentStreak: streak,
        personalBest,
        level: getLevel(streak),
        nextLevelAt: getNextLevelThreshold(streak),
      }
    });
  } catch (err) { next(err); }
};

module.exports = { getZeroDays, getStreak };

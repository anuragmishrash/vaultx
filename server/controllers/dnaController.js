const SpendDNA = require('../models/SpendDNA');
const { computeDNA, checkDNA } = require('../utils/dnaEngine');

const getDNA = async (req, res, next) => {
  try {
    const history = await SpendDNA.find({ userId: req.user._id }).sort({ computedAt: -1 }).limit(3);
    // Only use stored DNA snapshots that passed the minimum data threshold
    const validHistory = history.filter(h => h.meetsMinimum !== false);
    const current = validHistory[0] || null;

    // Light check — does NOT save anything
    const liveCheck = await checkDNA(req.user._id);

    res.json({
      success: true,
      current,
      history: validHistory,
      spendDNAType: current ? current.dominantType : null,
      canCompute: liveCheck.canCompute,
      reason: liveCheck.canCompute ? null : liveCheck.reason,
      progress: liveCheck.progress,
    });
  } catch (err) { next(err); }
};

const recomputeDNA = async (req, res, next) => {
  try {
    const result = await computeDNA(req.user._id);
    if (!result.canCompute) {
      return res.status(400).json({
        success: false,
        message: result.reason,
        progress: result.progress,
      });
    }
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { getDNA, recomputeDNA };

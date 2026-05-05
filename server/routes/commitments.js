const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCommitments, createCommitment, updateCommitment, deleteCommitment,
  pauseCommitment, getLogs, payCommitment, getVariance, getWaterfall,
  getAffordability, getSuggestions, acceptSuggestion, getPrediction,
} = require('../controllers/commitmentController');
const { ensureMonthlyRollover } = require('../middleware/commitmentSafetyNet');

router.use(protect);
router.use(ensureMonthlyRollover);

// Waterfall + Brain endpoints (before /:id routes to avoid param conflict)
router.get('/waterfall', getWaterfall);
router.get('/affordability', getAffordability);

// Logs
router.get('/logs', getLogs);
router.get('/logs/variance', getVariance);
router.post('/logs/:id/pay', payCommitment);

// CRUD
router.get('/', getCommitments);
router.post('/', createCommitment);
router.put('/:id', updateCommitment);
router.delete('/:id', deleteCommitment);
router.patch('/:id/pause', pauseCommitment);
router.get('/:id/prediction', getPrediction);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboard, getMonthly, getDayOfWeek, getFutureValue, getForecast, getCategoryTrends, getTfm } = require('../controllers/analyticsController');
const { ensureMonthlyRollover } = require('../middleware/commitmentSafetyNet');

router.use(protect);
router.use(ensureMonthlyRollover);
router.get('/dashboard', getDashboard);
router.get('/monthly', getMonthly);
router.get('/categories', getCategoryTrends);
router.get('/dayofweek', getDayOfWeek);
router.get('/forecast', getForecast);
router.get('/future-value', getFutureValue);
router.get('/tfm', getTfm);

module.exports = router;

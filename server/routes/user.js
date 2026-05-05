const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/bucketController');

// Money mode
router.patch('/money-mode', protect, ctrl.setMoneyMode);
router.patch('/spending-pool', protect, ctrl.setSpendingPool);
router.patch('/hide-wallet-balance', protect, ctrl.setHideBalance);

module.exports = router;

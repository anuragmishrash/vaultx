const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/cashController');
const { ensureMonthlyRollover } = require('../middleware/commitmentSafetyNet');

router.use(protect);
router.use(ensureMonthlyRollover);

router.get('/envelope', ctrl.getEnvelope);
router.post('/envelope', ctrl.createEnvelope);
router.patch('/envelope/count', ctrl.countWallet);
router.get('/analytics', ctrl.getCashAnalytics);
router.get('/ratio', ctrl.getCashRatio);

module.exports = router;

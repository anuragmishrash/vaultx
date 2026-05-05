const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/bucketController');

router.get('/net-worth', protect, ctrl.getNetWorth);
router.get('/net-worth/history', protect, ctrl.getNetWorthHistory);
router.get('/savings-accuracy', protect, ctrl.getSavingsAccuracy);
router.post('/transfer', protect, ctrl.transfer);

router.get('/', protect, ctrl.getBuckets);
router.post('/', protect, ctrl.createBucket);
router.put('/:id', protect, ctrl.updateBucket);
router.patch('/:id/balance', protect, ctrl.updateBalance);
router.delete('/:id', protect, ctrl.deleteBucket);

module.exports = router;

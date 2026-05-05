const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { logMood, getMoods, getCorrelation } = require('../controllers/moodController');

router.use(protect);
router.get('/', getMoods);
router.post('/', logMood);
router.get('/correlation', getCorrelation);

module.exports = router;

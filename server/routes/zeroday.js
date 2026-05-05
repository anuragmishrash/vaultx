const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getZeroDays, getStreak } = require('../controllers/zeroDayController');

router.use(protect);
router.get('/', getZeroDays);
router.get('/streak', getStreak);

module.exports = router;

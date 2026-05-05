const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDNA, recomputeDNA } = require('../controllers/dnaController');

router.use(protect);
router.get('/', getDNA);
router.post('/compute', recomputeDNA);

module.exports = router;

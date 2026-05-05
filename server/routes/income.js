const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getIncome, logIncome, deleteIncome } = require('../controllers/incomeController');

router.use(protect);
router.get('/', getIncome);
router.post('/', logIncome);
router.delete('/:id', deleteIncome);

module.exports = router;

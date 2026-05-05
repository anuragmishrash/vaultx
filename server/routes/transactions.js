const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { ensureMonthlyRollover } = require('../middleware/commitmentSafetyNet');
const { getTransactions, createTransaction, updateTransaction, deleteTransaction, bulkDeleteTransactions, rateRegret, exportCSV } = require('../controllers/transactionController');

router.use(protect);
router.use(ensureMonthlyRollover);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/bulk', bulkDeleteTransactions);
router.delete('/:id', deleteTransaction);
router.patch('/:id/regret', rateRegret);
router.get('/export/csv', exportCSV);

module.exports = router;

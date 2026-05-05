const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { protect } = require('../middleware/auth');
const { getSubscriptions, createSubscription, updateSubscription, deleteSubscription, detectFromCSV } = require('../controllers/subscriptionController');

router.use(protect);
router.get('/', getSubscriptions);
router.post('/', createSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);
router.post('/detect', upload.single('statement'), detectFromCSV);

module.exports = router;

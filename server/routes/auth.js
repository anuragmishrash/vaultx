const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { register, login, logout, refreshToken, getMe, updateProfile, deleteAccount } = require('../controllers/authController');

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
], validate, register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], validate, login);

router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccount);

module.exports = router;

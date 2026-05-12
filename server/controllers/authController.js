const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY,
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY,
  });
  return { accessToken, refreshToken };
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, monthlySalary, monthlyBudget } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      monthlySalary: monthlySalary || 0,
      monthlyBudget: monthlyBudget || 0,
    });

    const { accessToken, refreshToken } = generateTokens(user._id);
    await User.findByIdAndUpdate(user._id, { refreshToken });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      user: { id: userObj._id, ...userObj, _id: undefined },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user._id);
    await User.findByIdAndUpdate(user._id, { refreshToken });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    res.json({
      success: true,
      accessToken,
      user: { id: userObj._id, ...userObj, _id: undefined },
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    // Fetch WITH refreshToken so we can validate — only exclude password
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);
    await User.findByIdAndUpdate(user._id, { refreshToken: newRefresh });

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/',
    });

    // Return both token AND user so frontend can restore full session in one call
    // Strip sensitive fields from the response
    const userObj = user.toObject();
    delete userObj.refreshToken;
    delete userObj.__v;

    res.json({ success: true, accessToken, user: userObj });
  } catch (err) { next(err); }
};

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

const updateProfile = async (req, res, next) => {
  try {
    const updates = {};
    const allowed = ['name', 'monthlySalary', 'monthlyBudget', 'guiltyFreeAllowance', 'currency', 'theme', 'guiltyFreeRollover', 'commitmentCarryForward', 'notifications', 'moneyMode', 'spendingPool', 'spendingPoolMonth', 'spendingPoolYear', 'hideWalletBalance'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password -refreshToken');
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');
    const MoodLog = require('../models/MoodLog');
    const Subscription = require('../models/Subscription');
    const ZeroDayLog = require('../models/ZeroDayLog');
    const SpendDNA = require('../models/SpendDNA');
    const Commitment = require('../models/Commitment');
    const CommitmentLog = require('../models/CommitmentLog');

    const uid = req.user._id;
    await Promise.all([
      Transaction.deleteMany({ userId: uid }),
      MoodLog.deleteMany({ userId: uid }),
      Subscription.deleteMany({ userId: uid }),
      ZeroDayLog.deleteMany({ userId: uid }),
      SpendDNA.deleteMany({ userId: uid }),
      Commitment.deleteMany({ userId: uid }),
      CommitmentLog.deleteMany({ userId: uid }),
      User.findByIdAndDelete(uid),
    ]);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refreshToken, getMe, updateProfile, deleteAccount };

const Subscription = require('../models/Subscription');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { detectRecurring } = require('../utils/ghostDetector');

const getSubscriptions = async (req, res, next) => {
  try {
    const subs = await Subscription.find({ userId: req.user._id }).sort({ amount: -1 });
    const totalMonthly = subs.filter(s => s.isActive).reduce((sum, s) => {
      if (s.billingCycle === 'monthly') return sum + s.amount;
      if (s.billingCycle === 'quarterly') return sum + s.amount / 3;
      if (s.billingCycle === 'yearly') return sum + s.amount / 12;
      return sum;
    }, 0);
    res.json({ success: true, subscriptions: subs, totalMonthly: Math.round(totalMonthly) });
  } catch (err) { next(err); }
};

const createSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.create({ ...req.body, userId: req.user._id });
    res.status(201).json({ success: true, subscription: sub });
  } catch (err) { next(err); }
};

const updateSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true });
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, subscription: sub });
  } catch (err) { next(err); }
};

const deleteSubscription = async (req, res, next) => {
  try {
    await Subscription.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: 'Removed' });
  } catch (err) { next(err); }
};

const detectFromCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file' });
    const rows = [];
    const stream = Readable.from(req.file.buffer.toString());
    await new Promise((resolve, reject) => {
      stream.pipe(csv()).on('data', row => rows.push(row)).on('end', resolve).on('error', reject);
    });
    const detected = detectRecurring(rows);
    res.json({ success: true, detected, count: detected.length });
  } catch (err) { next(err); }
};

module.exports = { getSubscriptions, createSubscription, updateSubscription, deleteSubscription, detectFromCSV };

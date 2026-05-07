require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const CommitmentLog = require('../models/CommitmentLog');
  const Commitment = require('../models/Commitment');

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // All commitment logs where paidOn is this month
  const logs = await CommitmentLog.find({ isPaid: true, paidOn: { $gte: start, $lte: end } })
    .populate('commitmentId', 'title amount');

  console.log('\n=== PAID COMMITMENT LOGS (paidOn this month) ===');
  let total = 0;
  logs.forEach(l => {
    console.log('Commitment:', l.commitmentId?.title, '| paidOn:', l.paidOn?.toISOString().split('T')[0], '| actualAmount:', l.actualAmount);
    total += l.actualAmount || 0;
  });
  console.log('TOTAL BILLS PAID THIS MONTH (from CommitmentLog.paidOn):', total);

  // Check all commitment logs at all
  const allLogs = await CommitmentLog.find({ isPaid: true }).populate('commitmentId', 'title amount');
  console.log('\n=== ALL PAID COMMITMENT LOGS EVER ===');
  allLogs.forEach(l => {
    console.log('Commitment:', l.commitmentId?.title, '| month:', l.month, '/', l.year, '| paidOn:', l.paidOn?.toISOString().split('T')[0], '| actualAmount:', l.actualAmount);
  });

  mongoose.disconnect();
});

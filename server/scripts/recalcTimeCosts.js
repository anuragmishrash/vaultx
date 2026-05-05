require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { calcTimeCostHours } = require('../utils/timeCostHelpers');
const { calcFutureValue } = require('../utils/futureValueHelpers');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({ monthlySalary: { $gt: 0 } });

  for (const user of users) {
    const transactions = await Transaction.find({ userId: user._id });

    for (const txn of transactions) {
      const newTimeCost = calcTimeCostHours(txn.amount, user.monthlySalary);
      const newFV5 = calcFutureValue(txn.amount, 12, 5);
      const newFV10 = calcFutureValue(txn.amount, 12, 10);

      await Transaction.findByIdAndUpdate(txn._id, {
        timeCostHours: newTimeCost,
        futureValueAt5Yr: newFV5,
        futureValueAt10Yr: newFV10,
      });
    }
    console.log(`[Migration] Recalculated ${transactions.length} transactions for user ${user._id}`);
  }

  console.log('[Migration] Done — all time costs recalculated using salary');
  process.exit(0);
}).catch(console.error);

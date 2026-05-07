const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  // Connect to DB
  await mongoose.connect(process.env.MONGO_URI);

  const Transaction = require('../models/Transaction');

  // Fix: any transaction with a real category (not 'Guilt-Free')
  // that is incorrectly flagged as guilt-free
  const result = await Transaction.updateMany(
    {
      isGuiltyFreeSpend: true,
      $or: [
        { category: { $nin: ['Guilt-Free', null, undefined] } },
        { title: /milk|eggs|bread|rice|oats|vegetables|groceries/i },
      ]
    },
    { $set: { isGuiltyFreeSpend: false } }
  );

  console.log(`Fixed ${result.modifiedCount} wrongly flagged transactions`);

  // Also fix TransactionPattern isGuiltyFree classification for these items
  const TransactionPattern = require('../models/TransactionPattern');
  const patternResult = await TransactionPattern.updateMany(
    {
      patternType: 'guilt_free_habit',
      normalizedTitle: /milk|eggs|bread|rice|oats|vegetables/i,
    },
    { $set: { patternType: 'daily_purchase' } }
  );
  console.log(`Fixed ${patternResult.modifiedCount} wrongly classified patterns`);

  await mongoose.disconnect();
  console.log('Done');
}
fix();

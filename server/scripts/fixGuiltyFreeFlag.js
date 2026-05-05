const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixGuiltyFreeTransactions() {
  if (!process.env.MONGO_URI) dotenv.config({ path: path.join(__dirname, '../.env') });
  if (!process.env.MONGO_URI) dotenv.config();

  await mongoose.connect(process.env.MONGO_URI);

  // Find transactions that are marked guilt-free but are clearly regular purchases
  // (non-Guilt-Free categories that somehow got the guilt-free flag)
  const wrongTransactions = await Transaction.find({
    isGuiltyFreeSpend: true,
    category: {
      $nin: ['Guilt-Free', undefined, null]  // these categories should never be guilt-free
    }
  });

  console.log(`Found ${wrongTransactions.length} wrongly flagged transactions`);

  if (wrongTransactions.length > 0) {
    const result = await Transaction.updateMany(
      {
        isGuiltyFreeSpend: true,
        category: { $nin: ['Guilt-Free', undefined, null] }
      },
      { $set: { isGuiltyFreeSpend: false } }
    );
    console.log(`Fixed ${result.modifiedCount} transactions`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

fixGuiltyFreeTransactions();

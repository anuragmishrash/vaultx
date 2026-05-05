const mongoose = require('mongoose');
const User = require('../models/User.js');
const Transaction = require('../models/Transaction.js');
const TransactionPattern = require('../models/TransactionPattern.js');
const CategoryMemory = require('../models/CategoryMemory.js');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Update CategoryMemory
  await CategoryMemory.updateMany(
    { normalizedTitle: 'milk' },
    { $set: { category: 'Groceries' } }
  );
  console.log('CategoryMemory updated for milk');
  
  // Update TransactionPattern
  await TransactionPattern.updateMany(
    { normalizedTitle: 'milk' },
    { $set: { category: 'Groceries' } }
  );
  console.log('TransactionPattern updated for milk');
  
  // Fix Milk transactions isGuiltyFreeSpend to false
  await Transaction.updateMany(
    { normalizedTitle: 'milk', isGuiltyFreeSpend: true },
    { $set: { isGuiltyFreeSpend: false } }
  );
  console.log('Transaction updated for milk (removed guilt-free)');
  
  process.exit(0);
}
run();

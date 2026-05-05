const mongoose = require('mongoose');
const CashEnvelope = require('../models/CashEnvelope');
require('dotenv').config({path: '../.env'});
if (!process.env.MONGO_URI) require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find the actual user's April envelope that has the 1610 balance
  const apr = await CashEnvelope.findOne({ month: 4, currentBalance: { $gt: 0 } });
  
  if (apr) {
    const may = await CashEnvelope.findOne({ month: 5, userId: apr.userId });
    if (may) {
      may.openingBalance = apr.currentBalance;
      may.currentBalance = apr.currentBalance;
      await may.save();
      console.log('Fixed May envelope with balance:', may.currentBalance);
    } else {
      console.log('May envelope not found for user');
    }
  } else {
    console.log('No April envelope > 0 found');
  }
  process.exit(0);
}
run();

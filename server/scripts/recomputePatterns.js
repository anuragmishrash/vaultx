const mongoose = require('mongoose');
const User = require('../models/User.js');
const { analyzeAndUpdatePatterns } = require('../utils/patternEngine.js');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).select('_id');
  for (const user of users) {
    console.log(`Analyzing patterns for user ${user._id}...`);
    await analyzeAndUpdatePatterns(user._id);
  }
  console.log('Done.');
  process.exit(0);
}
run();

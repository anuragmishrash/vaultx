/**
 * Migrate MoneyBucket documents → Account model.
 * Run ONCE after deploying the new code:
 *   node server/scripts/migrateMoneyBuckets.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Account = require('../models/Account');
  const User    = require('../models/User');

  // Try to access MoneyBucket model
  let buckets = [];
  try {
    const MoneyBucket = require('../models/MoneyBucket');
    buckets = await MoneyBucket.find({});
    console.log(`Found ${buckets.length} MoneyBucket documents to migrate`);
  } catch (e) {
    console.log('No MoneyBucket model — skipping migration');
  }

  let created = 0;
  for (const bucket of buckets) {
    const exists = await Account.findOne({ userId: bucket.userId, name: bucket.name });
    if (exists) { console.log(`  Skip (exists): ${bucket.name}`); continue; }

    await Account.create({
      userId:    bucket.userId,
      name:      bucket.name,
      type:      bucket.type || 'bank_account',
      balance:   bucket.balance || 0,
      isDefault: bucket.isPrimary || false,
      isActive:  bucket.isActive !== false,
      balanceHistory: bucket.balanceHistory?.length
        ? bucket.balanceHistory
        : [{ balance: bucket.balance || 0, recordedAt: new Date(), note: 'Migrated from MoneyBucket' }],
      color: '#F5A623',
      icon: 'bank',
      createdAt: bucket.createdAt || new Date(),
    });
    created++;
    console.log(`  Migrated: ${bucket.name} (₹${bucket.balance})`);
  }
  console.log(`\nMigration: ${created} accounts created from MoneyBucket`);

  // Set defaultAccountId on each user from their primary/first account
  const users = await User.find({});
  let updated = 0;
  for (const user of users) {
    if (user.defaultAccountId) continue; // already set

    // Find their primary account first, else any account
    const defaultAcc = await Account.findOne({ userId: user._id, isDefault: true, isActive: true })
      || await Account.findOne({ userId: user._id, isActive: true }).sort({ createdAt: 1 });

    if (defaultAcc) {
      await Account.findByIdAndUpdate(defaultAcc._id, { isDefault: true });
      await User.findByIdAndUpdate(user._id, { defaultAccountId: defaultAcc._id });
      updated++;
      console.log(`  Set default account for ${user.name}: ${defaultAcc.name}`);
    }
  }
  console.log(`\nSet defaultAccountId for ${updated} users`);
  console.log('\n✅ Migration complete!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

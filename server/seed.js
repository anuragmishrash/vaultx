require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const MoodLog = require('./models/MoodLog');
const Subscription = require('./models/Subscription');
const SpendDNA = require('./models/SpendDNA');
const ZeroDayLog = require('./models/ZeroDayLog');
const Commitment = require('./models/Commitment');

const CATEGORIES = ['Food & Dining', 'Shopping', 'Transport', 'Entertainment', 'Utilities', 'Health & Fitness', 'Travel', 'Education', 'Personal Care', 'Investments'];
const PAYMENT_MODES = ['UPI', 'Card', 'Cash', 'Net Banking'];
const MOODS = ['great', 'good', 'neutral', 'stressed', 'sad'];
const MOOD_SCORES = { great: 5, good: 4, neutral: 3, stressed: 2, sad: 1 };

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clean demo user
  const existing = await User.findOne({ email: 'demo@vault.app' });
  if (existing) {
    await Transaction.deleteMany({ userId: existing._id });
    await MoodLog.deleteMany({ userId: existing._id });
    await Subscription.deleteMany({ userId: existing._id });
    await SpendDNA.deleteMany({ userId: existing._id });
    await ZeroDayLog.deleteMany({ userId: existing._id });
    await Commitment.deleteMany({ userId: existing._id });
    await User.deleteOne({ _id: existing._id });
  }

  const password = await bcrypt.hash('demo1234', 12);
  const user = await User.create({
    name: 'Anurag Sharma',
    email: 'demo@vault.app',
    password,
    monthlySalary: 60000,
    monthlyBudget: 35000,
    guiltyFreeAllowance: 2000,
    zeroDayStreak: 5,
    zeroDayPersonalBest: 12,
    spendDNAType: 'Comfort Spender',
  });

  console.log('Created demo user:', user.email);

  // Create subscriptions
  const subs = [
    { name: 'Netflix', amount: 649, billingCycle: 'monthly', category: 'Entertainment' },
    { name: 'Spotify', amount: 119, billingCycle: 'monthly', category: 'Entertainment' },
    { name: 'YouTube Premium', amount: 139, billingCycle: 'monthly', category: 'Entertainment' },
    { name: 'iCloud', amount: 75, billingCycle: 'monthly', category: 'Utilities' },
  ];
  for (const s of subs) {
    const next = new Date(); next.setDate(next.getDate() + rand(1, 28));
    await Subscription.create({ ...s, userId: user._id, isActive: true, nextDueDate: next, lastCharged: new Date() });
  }

  // Commitments
  const commitmentData = [
    { title: 'Rent', amount: 12000, category: 'Housing', dueDay: 1, priority: 'critical' },
    { title: 'Gym - Cult.fit', amount: 1200, category: 'Health & Fitness', dueDay: 5, priority: 'important' },
    { title: 'Protein - ON Whey', amount: 2200, category: 'Health & Fitness', dueDay: 3, priority: 'important' },
    { title: 'Internet - Jio Fiber', amount: 999, category: 'Utilities', dueDay: 10, priority: 'important' },
    { title: 'Electricity', amount: 800, category: 'Utilities', dueDay: 7, isFlexible: true, flexibleRange: { min: 600, max: 1200 }, priority: 'critical' },
  ];
  for (const c of commitmentData) {
    await Commitment.create({ ...c, userId: user._id, isActive: true });
  }

  // 3 months of transactions
  const titles = {
    'Food & Dining': ['Zomato order', 'Swiggy biryani', 'Starbucks coffee', 'McDonald\'s', 'Blinkit groceries', 'Chai tapri', 'Restaurant dinner'],
    'Shopping': ['Amazon purchase', 'Myntra outfit', 'Flipkart order', 'Nykaa skincare', 'H&M jacket'],
    'Transport': ['Ola ride', 'Uber cab', 'Metro pass', 'Rapido bike', 'Fuel top-up'],
    'Entertainment': ['Movie tickets', 'BookMyShow', 'Ludo gaming', 'Board game night'],
    'Utilities': ['BESCOM bill', 'Water bill', 'Gas cylinder'],
    'Health & Fitness': ['Pharmacy', 'Gym supplement', 'Doctor consultation'],
    'Travel': ['Flight booking', 'Hotel stay', 'Goa trip'],
    'Education': ['Udemy course', 'Book purchase', 'Coursera subscription'],
    'Personal Care': ['Haircut', 'Salon visit', 'Grooming kit'],
    'Investments': ['Zerodha SIP', 'Mutual fund', 'PPF deposit'],
  };

  const regretStatuses = ['pending', 'worth_it', 'okay', 'regret', 'worth_it', 'worth_it'];
  const transactions = [];

  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const base = new Date();
    base.setMonth(base.getMonth() - monthOffset);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const txCount = rand(50, 70);

    for (let i = 0; i < txCount; i++) {
      const cat = pick(CATEGORIES);
      const titleOptions = titles[cat] || ['Miscellaneous'];
      const t = {
        userId: user._id,
        title: pick(titleOptions),
        amount: cat === 'Travel' ? rand(1500, 8000) : cat === 'Investments' ? rand(2000, 5000) : rand(50, 1200),
        category: cat,
        paymentMode: pick(PAYMENT_MODES),
        date: new Date(base.getFullYear(), base.getMonth(), rand(1, daysInMonth)),
        regretStatus: monthOffset > 0 ? pick(regretStatuses) : (i < 5 ? 'pending' : pick(regretStatuses)),
        isGuiltyFreeSpend: false,
      };
      if (t.regretStatus !== 'pending') t.regretRatedAt = new Date(t.date.getTime() + 86400000);
      const hourlyRate = 60000 / (22 * 8);
      t.timeCostHours = parseFloat((t.amount / hourlyRate).toFixed(1));
      t.futureValueAt5Yr = Math.round(t.amount * Math.pow(1.12, 5));
      t.futureValueAt10Yr = Math.round(t.amount * Math.pow(1.12, 10));
      transactions.push(t);
    }
  }

  await Transaction.insertMany(transactions);
  console.log(`Created ${transactions.length} transactions`);

  // Mood logs - 90 days
  const moodLogs = [];
  for (let d = 90; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const mood = pick(MOODS);
    const dayTxns = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === date.getFullYear() && td.getMonth() === date.getMonth() && td.getDate() === date.getDate();
    });
    const totalSpent = dayTxns.reduce((s, t) => s + t.amount, 0);
    moodLogs.push({ userId: user._id, mood, moodScore: MOOD_SCORES[mood], date, totalSpentSameDay: totalSpent });
  }
  await MoodLog.insertMany(moodLogs);
  console.log(`Created ${moodLogs.length} mood logs`);

  // DNA snapshot
  await SpendDNA.create({
    userId: user._id,
    snapshot: { comfort: 42, experience: 20, impulse: 25, discipline: 13 },
    dominantType: 'Comfort Spender',
  });

  // Zero day logs - last 30 days
  for (let d = 30; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dayTxns = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === date.getFullYear() && td.getMonth() === date.getMonth() && td.getDate() === date.getDate();
    });
    const total = dayTxns.reduce((s, t) => s + t.amount, 0);
    await ZeroDayLog.create({ userId: user._id, date, wasZeroDay: total === 0, totalSpent: total });
  }

  console.log('✅ Seed complete! Login: demo@vault.app / demo1234');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });

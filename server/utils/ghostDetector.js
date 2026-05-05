/**
 * Ghost Detector — finds recurring charges from CSV bank statements
 * Expected CSV columns: Date, Description, Debit, Credit, Balance
 */
const detectRecurring = (rows) => {
  // Group by normalized merchant name
  const merchantMap = {};

  rows.forEach(row => {
    const desc = (row.Description || row.Narration || row.Particulars || '').trim().toLowerCase();
    const amount = parseFloat(row.Debit || row.Amount || 0);
    const date = new Date(row.Date || row['Value Date']);
    if (!desc || isNaN(amount) || amount <= 0 || isNaN(date)) return;

    // Normalize: take first 4 words
    const key = desc.split(' ').slice(0, 4).join(' ');
    if (!merchantMap[key]) merchantMap[key] = [];
    merchantMap[key].push({ date, amount, desc });
  });

  const recurring = [];

  for (const [key, entries] of Object.entries(merchantMap)) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.date - b.date);

    // Check if intervals are ~25–35 days
    let isRecurring = true;
    const amounts = entries.map(e => e.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance = Math.max(...amounts) - Math.min(...amounts);

    for (let i = 1; i < entries.length; i++) {
      const daysDiff = (entries[i].date - entries[i-1].date) / (1000 * 60 * 60 * 24);
      if (daysDiff < 20 || daysDiff > 45) { isRecurring = false; break; }
    }

    if (isRecurring && amountVariance / avgAmount < 0.2) {
      const lastEntry = entries[entries.length - 1];
      const nextDue = new Date(lastEntry.date);
      nextDue.setDate(nextDue.getDate() + 30);

      recurring.push({
        name: entries[0].desc.split(' ').slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        amount: Math.round(avgAmount),
        billingCycle: 'monthly',
        nextDueDate: nextDue,
        lastCharged: lastEntry.date,
        autoDetected: true,
        category: 'Entertainment',
      });
    }
  }

  return recurring;
};

module.exports = { detectRecurring };

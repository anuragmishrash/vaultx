/**
 * budgetHelpers.js
 * Returns the effective budget for a user based on their money mode and settings.
 * Never returns 0 — always returns a meaningful number or null.
 */

function getEffectiveBudget(user) {
  // Priority 1: explicit monthly budget
  if (user.monthlyBudget && user.monthlyBudget > 0) {
    return {
      amount: user.monthlyBudget,
      source: 'budget',
      label: `Budget: ₹${user.monthlyBudget.toLocaleString('en-IN')}`,
    };
  }

  // Priority 2: spending pool (Mode 2)
  if (user.moneyMode === 'pool' && user.spendingPool && user.spendingPool > 0) {
    return {
      amount: user.spendingPool,
      source: 'pool',
      label: `Spending pool: ₹${user.spendingPool.toLocaleString('en-IN')}`,
    };
  }

  // Priority 3: salary as a rough reference
  if (user.monthlySalary && user.monthlySalary > 0) {
    return {
      amount: user.monthlySalary,
      source: 'salary',
      label: `Based on salary: ₹${user.monthlySalary.toLocaleString('en-IN')}`,
    };
  }

  // No reference at all
  return {
    amount: null,
    source: 'none',
    label: 'No budget set',
  };
}

module.exports = { getEffectiveBudget };

export const calcFV = (presentValue, annualRate, years) => {
  if (!presentValue || !years) return 0;
  return Math.round(presentValue * Math.pow(1 + (annualRate || 12) / 100, years));
};

export const calcSIPFV = (monthlyAmount, annualRate, years) => {
  const r = (annualRate || 12) / 100 / 12;
  const n = years * 12;
  return Math.round(monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
};

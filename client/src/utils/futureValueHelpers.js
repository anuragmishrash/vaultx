export function calcFutureValue(amount, annualRatePercent, years) {
  return Math.round(amount * Math.pow(1 + annualRatePercent / 100, years));
}

export function shouldShowFutureValue(amount, years = 5, rate = 12) {
  const fv = calcFutureValue(amount, rate, years);
  const gain = fv - amount;
  return gain >= 50; 
}

export function getFutureValueLabel(amount, years = 5, rate = 12) {
  if (!shouldShowFutureValue(amount, years, rate)) return null;

  const fv = calcFutureValue(amount, rate, years);
  return `→ ₹${fv.toLocaleString('en-IN')} in ${years}yr`;
}

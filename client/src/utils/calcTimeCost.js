export const calcTimeCostHours = (amount, monthlySalary) => {
  if (!monthlySalary || monthlySalary <= 0) return null;
  const hourlyRate = monthlySalary / (22 * 8);
  return parseFloat((amount / hourlyRate).toFixed(1));
};

export const formatTimeCost = (hours) => {
  if (hours === null || hours === undefined) return null;
  if (hours < 1) return `${Math.round(hours * 60)} mins of work`;
  if (hours < 8) return `${hours} hrs of work`;
  return `${(hours / 8).toFixed(1)} days of work`;
};

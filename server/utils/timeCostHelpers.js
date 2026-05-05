function calcTimeCostHours(amount, monthlySalary) {
  if (!monthlySalary || monthlySalary <= 0) return null;

  const WORKING_HOURS_PER_MONTH = 176; // 22 days × 8 hours
  const hourlyRate = monthlySalary / WORKING_HOURS_PER_MONTH;
  const hours = amount / hourlyRate;

  return Math.round(hours * 100) / 100;
}

function formatTimeCost(hours) {
  if (hours === null || hours === undefined) return null;

  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    if (minutes < 1) return '< 1 min';
    return `${minutes} min`;
  }

  if (hours < 2) {
    const wholeHours = Math.floor(hours);
    const remainingMinutes = Math.round((hours - wholeHours) * 60);
    if (remainingMinutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${remainingMinutes}min`;
  }

  if (hours % 1 === 0) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function getTimeCostLabel(amount, monthlySalary) {
  const hours = calcTimeCostHours(amount, monthlySalary);
  if (hours === null) return null;
  const formatted = formatTimeCost(hours);
  return `${formatted} of work`;
}

module.exports = {
  calcTimeCostHours,
  formatTimeCost,
  getTimeCostLabel
};

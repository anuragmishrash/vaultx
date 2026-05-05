/**
 * commitmentHelpers.js
 * Single source of truth for commitment status logic.
 * A commitment is ALWAYS relevant for the current month.
 * Status is: paid | due_today | upcoming | overdue | missed
 */

function getDaySuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Determines commitment status for a specific month/year.
 * @param {Object} commitment - Commitment document
 * @param {Object|null} log - CommitmentLog for this month (null if none)
 * @param {number} month - 1–12
 * @param {number} year - e.g., 2026
 */
function getCommitmentStatusForMonth(commitment, log, month, year) {
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  const isCurrentMonth = (todayMonth === month && todayYear === year);
  const isPastMonth = (year < todayYear) || (year === todayYear && month < todayMonth);
  const isFutureMonth = !isCurrentMonth && !isPastMonth;

  // Handle edge case: dueDay > days in month (e.g. Feb 31 → Feb 28)
  const daysInMonth = new Date(year, month, 0).getDate();
  const actualDueDay = Math.min(commitment.dueDay || 1, daysInMonth);
  const dueDate = new Date(year, month - 1, actualDueDay);

  // Paid this month?
  if (log && log.isPaid) {
    return {
      status: 'paid',
      dueDate,
      isPaid: true,
      isOverdue: false,
      isUpcoming: false,
      daysUntilDue: null,
      daysOverdue: null,
      actualAmount: log.actualAmount,
      paidOn: log.paidOn,
    };
  }

  // Future month — always upcoming
  if (isFutureMonth) {
    const daysUntilDue = Math.max(0, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));
    return {
      status: 'upcoming',
      dueDate,
      isPaid: false,
      isOverdue: false,
      isUpcoming: true,
      daysUntilDue,
      daysOverdue: null,
    };
  }

  // Past month — not paid = missed
  if (isPastMonth) {
    return {
      status: 'missed',
      dueDate,
      isPaid: false,
      isOverdue: true,
      isUpcoming: false,
      daysUntilDue: null,
      daysOverdue: null,
    };
  }

  // Current month — compute based on today's date vs due date
  if (todayDate < actualDueDay) {
    const daysUntilDue = actualDueDay - todayDate;
    return {
      status: 'upcoming',
      dueDate,
      isPaid: false,
      isOverdue: false,
      isUpcoming: true,
      daysUntilDue,
      daysOverdue: null,
    };
  }

  if (todayDate === actualDueDay) {
    return {
      status: 'due_today',
      dueDate,
      isPaid: false,
      isOverdue: false,
      isUpcoming: false,
      daysUntilDue: 0,
      daysOverdue: null,
    };
  }

  // Due date has passed this month, not paid
  const daysOverdue = todayDate - actualDueDay;
  return {
    status: 'overdue',
    dueDate,
    isPaid: false,
    isOverdue: true,
    isUpcoming: false,
    daysUntilDue: null,
    daysOverdue,
  };
}

/**
 * Context-aware due date label for display.
 */
function getDueDateLabel(statusObj) {
  if (!statusObj) return '';
  const { status, dueDate, daysUntilDue, daysOverdue, paidOn, actualAmount } = statusObj;

  let dayStr = '';
  let suffix = '';
  if (dueDate) {
    const d = new Date(dueDate);
    dayStr = d.getDate();
    suffix = getDaySuffix(dayStr);
  }

  switch (status) {
    case 'paid':
      if (paidOn) {
        const pd = new Date(paidOn);
        return `Paid on ${pd.getDate()}${getDaySuffix(pd.getDate())} ${pd.toLocaleString('en-IN', { month: 'short' })}`;
      }
      return 'Paid this month';

    case 'due_today':
      return `Due TODAY (${dayStr}${suffix})`;

    case 'upcoming':
      if (daysUntilDue === 1) return `Due tomorrow (${dayStr}${suffix})`;
      if (daysUntilDue <= 3) return `Due in ${daysUntilDue} days (${dayStr}${suffix})`;
      return `Due ${dayStr}${suffix}`;

    case 'overdue':
      if (daysOverdue === 1) return `Was due yesterday — not paid yet`;
      return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} (was due ${dayStr}${suffix})`;

    case 'missed':
      return `Not paid (was due ${dayStr}${suffix})`;

    default:
      return `Due ${dayStr}${suffix}`;
  }
}

module.exports = { getCommitmentStatusForMonth, getDueDateLabel, getDaySuffix };

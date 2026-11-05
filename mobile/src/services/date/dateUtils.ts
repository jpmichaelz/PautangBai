/**
 * Safe local calendar date utilities.
 * Avoids UTC timezone day-shifting bugs when formatting YYYY-MM-DD.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // midday avoids DST shift
}

export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7);
}

/**
 * Safely adds months without unintentional month-skipping on 29th/30th/31st.
 * e.g., Jan 31 + 1 month becomes Feb 28 (or Feb 29 on leap year).
 */
export function addMonthsSafe(dateStr: string, monthsToAdd: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthIndex = (month - 1) + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

  // Day 0 of next month is the last day of target month
  const maxDaysInTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  const m = String(normalizedMonthIndex + 1).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${targetYear}-${m}-${d}`;
}

/**
 * Check if a due date is strictly in the past relative to today or compareDate.
 */
export function isDatePast(dueDateStr: string, compareDateStr?: string): boolean {
  const reference = compareDateStr || getLocalDateString();
  return dueDateStr < reference;
}

/**
 * Validate that a date string is in strict YYYY-MM-DD format and represents a real calendar date.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  // Month in JS Date constructor is 0-indexed. Day 0 of next month is the last day of given month.
  const maxDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

export type DueDateBucket = 'overdue' | 'due_today' | 'due_this_week' | 'later' | 'no_due_date';

/**
 * Categorize a loan's due date into collection schedule buckets:
 * - overdue: strictly in the past (< today)
 * - due_today: exactly today
 * - due_this_week: within the next 7 days (> today && <= today + 7 days)
 * - later: more than 7 days ahead
 * - no_due_date: missing or empty due date
 */
export function getDueDateBucket(
  dueDateStr: string | null | undefined,
  todayStr?: string,
): DueDateBucket {
  if (!dueDateStr) return 'no_due_date';
  const today = todayStr || getLocalDateString();
  if (dueDateStr < today) return 'overdue';
  if (dueDateStr === today) return 'due_today';
  const weekEnd = addDays(today, 7);
  if (dueDateStr > today && dueDateStr <= weekEnd) return 'due_this_week';
  return 'later';
}

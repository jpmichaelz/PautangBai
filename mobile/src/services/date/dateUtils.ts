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

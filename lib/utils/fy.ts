/**
 * Utility functions for Financial Year (FY) calculations.
 * In India, the Financial Year starts on April 1st and ends on March 31st.
 */

/** FY 2023 is the baseline year for analytics timeline */
export const BASELINE_FY = 2023;

/**
 * Gets the current Financial Year based on a date.
 * If month is April (3) or later, FY is current year.
 * Otherwise, FY is previous year.
 * @param date optional date, defaults to now
 * @returns The starting year of the FY (e.g., 2024 for FY 2024-25)
 */
export function getCurrentFinancialYear(date: Date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 3 ? year : year - 1;
}

/**
 * Gets the date range for a given Financial Year.
 * @param fy The starting year of the FY (e.g., 2024)
 * @returns { from: Date, to: Date }
 */
export function getFYDateRange(fy: number): { from: Date; to: Date } {
  const from = new Date(fy, 3, 1); // April 1st of FY
  const to = new Date(fy + 1, 2, 31); // March 31st of FY + 1
  return { from, to };
}

/**
 * Formats the FY for display.
 * @param fy The starting year of the FY
 * @returns string like "FY 2024-25" or "FY 2024"
 */
export function formatFY(fy: number, short: boolean = true): string {
  if (short) return `FY ${fy}`;
  const nextYear = (fy + 1).toString().slice(-2);
  return `FY ${fy}-${nextYear}`;
}

export function getFullFYForDateRange(range: {
  from: Date | string;
  to: Date | string;
}): number | null {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const fromYear = getCurrentFinancialYear(from);
  const expected = getFYDateRange(fromYear);

  if (
    from.getFullYear() === expected.from.getFullYear() &&
    from.getMonth() === expected.from.getMonth() &&
    from.getDate() === expected.from.getDate() &&
    to.getFullYear() === expected.to.getFullYear() &&
    to.getMonth() === expected.to.getMonth() &&
    to.getDate() === expected.to.getDate()
  ) {
    return fromYear;
  }

  return null;
}

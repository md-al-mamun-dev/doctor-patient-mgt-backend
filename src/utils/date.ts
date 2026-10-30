import { AppError } from './errors.js';

const DHAKA_OFFSET_HOURS = 6;

/**
 * Validates and converts YYYY-MM-DD calendar dates into UTC Date boundaries representing
 * full whole days in Asia/Dhaka time (UTC+6).
 */
export function parseDhakaDateRange(
  from?: string,
  to?: string
): { startDate?: Date; endDate?: Date } {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (from) {
    if (!dateRegex.test(from)) {
      throw new AppError('Date "from" must be in YYYY-MM-DD format', 400, 'VALIDATION_ERROR', [
        { path: 'from', message: 'Use YYYY-MM-DD format' },
      ]);
    }
    // Start of day in Dhaka: YYYY-MM-DDT00:00:00+06:00
    const [year, month, day] = from.split('-').map(Number);
    startDate = new Date(Date.UTC(year, month - 1, day, 0 - DHAKA_OFFSET_HOURS, 0, 0, 0));
  }

  if (to) {
    if (!dateRegex.test(to)) {
      throw new AppError('Date "to" must be in YYYY-MM-DD format', 400, 'VALIDATION_ERROR', [
        { path: 'to', message: 'Use YYYY-MM-DD format' },
      ]);
    }
    // End of day in Dhaka: YYYY-MM-DDT23:59:59.999+06:00
    const [year, month, day] = to.split('-').map(Number);
    endDate = new Date(Date.UTC(year, month - 1, day, 23 - DHAKA_OFFSET_HOURS, 59, 59, 999));
  }

  if (startDate && endDate && startDate > endDate) {
    throw new AppError('Date "from" cannot be later than date "to"', 400, 'VALIDATION_ERROR', [
      { path: 'from', message: 'from date cannot be after to date' },
    ]);
  }

  return { startDate, endDate };
}

/**
 * Validates single calendar date in YYYY-MM-DD format and returns Date object.
 */
export function parseCalendarDate(dateStr: string): Date {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new AppError('Date must be in YYYY-MM-DD format', 400, 'VALIDATION_ERROR', [
      { path: 'admissionDate', message: 'Use YYYY-MM-DD format' },
    ]);
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}


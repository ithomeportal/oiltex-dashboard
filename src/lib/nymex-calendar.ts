// NYMEX trading calendar for the WTI CL contract (/calendar).
//
// Holidays are the observed dates on which NYMEX energy does not settle. A holiday that
// falls on Saturday is observed the Friday before, on Sunday the Monday after — except
// New Year's Day on a Saturday, which is not observed at all (2028-01-01).
// Juneteenth is not listed (matches the original 2026–2027 convention); it never
// falls inside a CL last-trading-day window for 2025–2028.

export const NYMEX_HOLIDAYS: Readonly<Record<string, string>> = {
  // 2024 tail — the 2025 view lists CLF25, whose last trading day is in Dec 2024
  "2024-12-25": "Christmas",

  "2025-01-01": "New Year's Day",
  "2025-01-20": "MLK Day",
  "2025-02-17": "Presidents Day",
  "2025-04-18": "Good Friday",
  "2025-05-26": "Memorial Day",
  "2025-07-04": "Independence Day",
  "2025-09-01": "Labor Day",
  "2025-11-27": "Thanksgiving",
  "2025-12-25": "Christmas",

  "2026-01-01": "New Year's Day",
  "2026-01-19": "MLK Day",
  "2026-02-16": "Presidents Day",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-07-03": "Independence Day",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving",
  "2026-12-25": "Christmas",

  "2027-01-01": "New Year's Day",
  "2027-01-18": "MLK Day",
  "2027-02-15": "Presidents Day",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-07-05": "Independence Day",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving",
  "2027-12-24": "Christmas",

  // 2028: New Year's Day is a Saturday and is not observed
  "2028-01-17": "MLK Day",
  "2028-02-21": "Presidents Day",
  "2028-04-14": "Good Friday",
  "2028-05-29": "Memorial Day",
  "2028-07-04": "Independence Day",
  "2028-09-04": "Labor Day",
  "2028-11-23": "Thanksgiving",
  "2028-12-25": "Christmas",
};

/** Local calendar date as YYYY-MM-DD (toISOString would shift a day east of UTC). */
export function formatDateStr(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(dateStr: string): boolean {
  return dateStr in NYMEX_HOLIDAYS;
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(formatDateStr(date));
}

function shiftBusinessDays(date: Date, days: number, step: 1 | -1): Date {
  const result = new Date(date);
  let count = 0;
  while (count < days) {
    result.setDate(result.getDate() + step);
    if (isBusinessDay(result)) {
      count++;
    }
  }
  return result;
}

export interface ContractDates {
  contractMonth: number; // 0-indexed month for delivery
  contractYear: number;
  lastTradingDay: Date;
  firstNoticeDay: Date;
  tradeMonthStart: Date;
  tradeMonthEnd: Date;
}

/** WTI CL contract dates for a delivery month (0-indexed). */
export function calculateContractDates(year: number, month: number): ContractDates {
  // Month preceding the contract month
  let precedingMonth = month - 1;
  let precedingYear = year;
  if (precedingMonth < 0) {
    precedingMonth = 11;
    precedingYear = year - 1;
  }

  // 25th of the preceding month
  const the25th = new Date(precedingYear, precedingMonth, 25);

  // CME Rule for WTI CL:
  // - If 25th is a business day: LTD = 3 business days before the 25th
  // - If 25th is NOT a business day: LTD = 4 business days before the 25th
  const daysToSubtract = isBusinessDay(the25th) ? 3 : 4;
  const lastTradingDay = shiftBusinessDays(the25th, daysToSubtract, -1);

  // First Notice Day: 1 business day after Last Trading Day
  const firstNoticeDay = shiftBusinessDays(lastTradingDay, 1, 1);

  // Trade month period (for Argus pricing)
  // Runs from 26th of M-2 to 25th of M-1
  let tradeStartMonth = month - 2;
  let tradeStartYear = year;
  if (tradeStartMonth < 0) {
    tradeStartMonth += 12;
    tradeStartYear -= 1;
  }
  const tradeMonthStart = new Date(tradeStartYear, tradeStartMonth, 26);
  const tradeMonthEnd = new Date(precedingYear, precedingMonth, 25);

  return {
    contractMonth: month,
    contractYear: year,
    lastTradingDay,
    firstNoticeDay,
    tradeMonthStart,
    tradeMonthEnd,
  };
}

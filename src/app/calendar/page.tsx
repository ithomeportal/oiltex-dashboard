"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

// NYMEX holidays 2026
const NYMEX_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-19": "MLK Day",
  "2026-02-16": "Presidents Day",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-07-03": "Independence Day",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving",
  "2026-12-25": "Christmas",
};

// NYMEX holidays 2027
const NYMEX_HOLIDAYS_2027: Record<string, string> = {
  "2027-01-01": "New Year's Day",
  "2027-01-18": "MLK Day",
  "2027-02-15": "Presidents Day",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-07-05": "Independence Day",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving",
  "2027-12-24": "Christmas",
};

const ALL_HOLIDAYS: Record<string, string> = { ...NYMEX_HOLIDAYS_2026, ...NYMEX_HOLIDAYS_2027 };

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr: string): boolean {
  return dateStr in ALL_HOLIDAYS;
}

function isBusinessDay(date: Date): boolean {
  const dateStr = formatDateStr(date);
  return !isWeekend(date) && !isHoliday(dateStr);
}

function formatDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < days) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result)) {
      count++;
    }
  }
  return result;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      count++;
    }
  }
  return result;
}

interface ContractDates {
  contractMonth: number; // 0-indexed month for delivery
  contractYear: number;
  lastTradingDay: Date;
  firstNoticeDay: Date;
  tradeMonthStart: Date;
  tradeMonthEnd: Date;
}

// Calculate WTI CL contract dates
function calculateContractDates(year: number, month: number): ContractDates {
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
  const lastTradingDay = subtractBusinessDays(the25th, daysToSubtract);

  // First Notice Day: 1 business day after Last Trading Day
  const firstNoticeDay = addBusinessDays(lastTradingDay, 1);

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

// Generate all contract dates for a year
function generateYearContracts(year: number): ContractDates[] {
  const contracts: ContractDates[] = [];
  for (let month = 0; month < 12; month++) {
    contracts.push(calculateContractDates(year, month));
  }
  // Also include next year's first few months for trade periods that span years
  contracts.push(calculateContractDates(year + 1, 0));
  contracts.push(calculateContractDates(year + 1, 1));
  contracts.push(calculateContractDates(year + 1, 2));
  return contracts;
}

interface DayInfo {
  date: Date;
  dateStr: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isLastTradingDay?: string; // Contract code
  isFirstNoticeDay?: string; // Contract code
  tradePeriods: string[]; // Contract codes for active trade periods
  isTradeMonthStart: string[]; // Contract codes where this is trade period start (26th)
  isTradeMonthEnd: string[]; // Contract codes where this is trade period end (25th)
}

// Generate calendar data for a month
function generateMonthCalendar(year: number, month: number, contracts: ContractDates[]): DayInfo[][] {
  const weeks: DayInfo[][] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from the first day that appears in the calendar grid
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const monthCodes = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];

  let currentDate = new Date(startDate);

  while (currentDate <= lastDay || currentDate.getDay() !== 0) {
    const week: DayInfo[] = [];

    for (let i = 0; i < 7; i++) {
      const dateStr = formatDateStr(currentDate);
      const dayInfo: DayInfo = {
        date: new Date(currentDate),
        dateStr,
        isWeekend: isWeekend(currentDate),
        isHoliday: isHoliday(dateStr),
        holidayName: ALL_HOLIDAYS[dateStr],
        tradePeriods: [],
        isTradeMonthStart: [],
        isTradeMonthEnd: [],
      };

      // Check if this day is a special date for any contract
      for (const contract of contracts) {
        const contractCode = `CL${monthCodes[contract.contractMonth]}${String(contract.contractYear).slice(-2)}`;

        if (formatDateStr(contract.lastTradingDay) === dateStr) {
          dayInfo.isLastTradingDay = contractCode;
        }
        if (formatDateStr(contract.firstNoticeDay) === dateStr) {
          dayInfo.isFirstNoticeDay = contractCode;
        }

        // Check if day is within trade period
        if (currentDate >= contract.tradeMonthStart && currentDate <= contract.tradeMonthEnd) {
          dayInfo.tradePeriods.push(contractCode);
        }

        // Check if day is trade month start (26th) or end (25th)
        if (formatDateStr(contract.tradeMonthStart) === dateStr) {
          dayInfo.isTradeMonthStart.push(contractCode);
        }
        if (formatDateStr(contract.tradeMonthEnd) === dateStr) {
          dayInfo.isTradeMonthEnd.push(contractCode);
        }
      }

      week.push(dayInfo);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    weeks.push(week);

    // Stop if we've passed the last day and completed the week
    if (currentDate.getMonth() !== month && currentDate.getDay() === 0) {
      break;
    }
  }

  return weeks;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const contracts = generateYearContracts(selectedYear);

  // Get current trade period for highlighting
  const today = new Date();
  const todayStr = formatDateStr(today);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">US Crude Oil Trading Calendar {selectedYear}</h1>
              <p className="text-slate-500 text-sm mt-1">
                WTI Futures contract dates, trade periods, and NYMEX holidays
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ←
              </button>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white font-semibold"
              >
                {[2025, 2026, 2027, 2028].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                →
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500"></div>
                <span className="text-slate-600">Trade Period</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span className="text-slate-600">Last Trading Day</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-slate-600">First Notice Day</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-200 border border-green-400"></div>
                <span className="text-slate-600">NYMEX Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100"></div>
                <span className="text-slate-600">Weekend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-200 border-2 border-yellow-400"></div>
                <span className="text-slate-600">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-[8px] font-bold text-fuchsia-700">26</div>
                <span className="text-slate-600">Trade Month Start/End</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid - 4 columns x 3 rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const weeks = generateMonthCalendar(selectedYear, monthIndex, contracts);

              return (
                <div key={monthIndex} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  {/* Month Header */}
                  <div className="bg-slate-700 text-white px-3 py-2 text-center font-semibold">
                    {MONTH_NAMES[monthIndex]}
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
                    {DAY_NAMES.map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="p-1">
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7">
                        {week.map((day, dayIndex) => {
                          const isCurrentMonth = day.date.getMonth() === monthIndex;
                          const isToday = day.dateStr === todayStr;
                          const inTradePeriod = day.tradePeriods.length > 0;

                          let bgColor = "bg-white";
                          let textColor = isCurrentMonth ? "text-slate-800" : "text-slate-300";
                          let border = "";

                          // Bold the trade month start (26th) and end (25th) days with fuchsia color
                          const isTradeMonthBoundary = day.isTradeMonthStart.length > 0 || day.isTradeMonthEnd.length > 0;
                          let extraClasses = isCurrentMonth && isTradeMonthBoundary ? "font-bold" : "";

                          if (isCurrentMonth) {
                            // Apply fuchsia color for trade month boundaries (26th/25th)
                            if (isTradeMonthBoundary) {
                              textColor = "text-fuchsia-700";
                            }

                            if (isToday) {
                              bgColor = "bg-yellow-200";
                              border = "ring-2 ring-yellow-400";
                            } else if (day.isLastTradingDay) {
                              bgColor = "bg-orange-500";
                              textColor = "text-white";
                            } else if (day.isFirstNoticeDay) {
                              bgColor = "bg-red-500";
                              textColor = "text-white";
                            } else if (day.isHoliday) {
                              bgColor = "bg-green-200";
                              border = "border border-green-400";
                            } else if (day.isWeekend) {
                              bgColor = "bg-slate-100";
                              textColor = isTradeMonthBoundary ? "text-fuchsia-700" : "text-slate-400";
                            } else if (inTradePeriod) {
                              bgColor = "bg-blue-100";
                              border = "border-l-2 border-r-2 border-blue-400";
                            }
                          }

                          return (
                            <div
                              key={dayIndex}
                              className={`relative h-7 flex items-center justify-center text-xs font-medium ${bgColor} ${textColor} ${border} ${extraClasses}`}
                              title={
                                day.isLastTradingDay
                                  ? `Last Trading Day: ${day.isLastTradingDay}`
                                  : day.isFirstNoticeDay
                                  ? `First Notice Day: ${day.isFirstNoticeDay}`
                                  : day.isHoliday
                                  ? day.holidayName
                                  : day.isTradeMonthStart.length > 0
                                  ? `Trade Month Start: ${day.isTradeMonthStart.join(", ")}`
                                  : day.isTradeMonthEnd.length > 0
                                  ? `Trade Month End: ${day.isTradeMonthEnd.join(", ")}`
                                  : day.tradePeriods.length > 0
                                  ? `Trade Period: ${day.tradePeriods.join(", ")}`
                                  : ""
                              }
                            >
                              {day.date.getDate()}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contract Table */}
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">
                {selectedYear} Contract Details
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Contract</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Delivery</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Trade Period</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Last Trading</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">First Notice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {contracts.slice(0, 12).map((contract, i) => {
                    const monthCodes = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];
                    const code = `CL${monthCodes[contract.contractMonth]}${String(contract.contractYear).slice(-2)}`;
                    const isActive = today >= contract.tradeMonthStart && today <= contract.tradeMonthEnd;

                    return (
                      <tr key={i} className={isActive ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-4 py-2 font-mono font-semibold text-slate-800">{code}</td>
                        <td className="px-4 py-2 text-slate-700">
                          {MONTH_NAMES[contract.contractMonth]} {contract.contractYear}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {contract.tradeMonthStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {contract.tradeMonthEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-medium">
                            {contract.lastTradingDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-medium">
                            {contract.firstNoticeDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Disclaimer:</strong> Dates are calculated programmatically based on CME Group rules.
              Always verify critical dates against the official CME Group calendar at{" "}
              <a
                href="https://www.cmegroup.com/tools-information/calendars/expiration-calendar.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                cmegroup.com
              </a>
              . Holiday schedules and exceptional circumstances may affect actual trading dates.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

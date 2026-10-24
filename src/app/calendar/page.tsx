"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { Field } from "@/components/ui/Controls";
import {
  BTN_SECONDARY,
  CARD,
  SELECT,
  STICKY_HEAD,
  TABLE,
  TABLE_SCROLL,
  TD,
  TH,
  TR,
} from "@/components/ui/styles";
import {
  NYMEX_HOLIDAYS,
  calculateContractDates,
  formatDateStr,
  isHoliday,
  isWeekend,
  type ContractDates,
} from "@/lib/nymex-calendar";

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

  const currentDate = new Date(startDate);

  while (currentDate <= lastDay || currentDate.getDay() !== 0) {
    const week: DayInfo[] = [];

    for (let i = 0; i < 7; i++) {
      const dateStr = formatDateStr(currentDate);
      const dayInfo: DayInfo = {
        date: new Date(currentDate),
        dateStr,
        isWeekend: isWeekend(currentDate),
        isHoliday: isHoliday(dateStr),
        holidayName: NYMEX_HOLIDAYS[dateStr],
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

/** Legend chips — swatches mirror the day-cell colours below. */
const LEGEND: readonly { label: string; swatch: string; text?: string }[] = [
  { label: "Trade Period", swatch: "bg-blue-100 border-2 border-blue-500" },
  { label: "Last Trading Day", swatch: "bg-orange-500" },
  { label: "First Notice Day", swatch: "bg-red-500" },
  { label: "NYMEX Holiday", swatch: "bg-green-200 border border-green-400" },
  { label: "Weekend", swatch: "bg-slate-100 border border-slate-200" },
  { label: "Today", swatch: "bg-yellow-200 border-2 border-yellow-400" },
  { label: "Trade Month Start/End", swatch: "bg-fuchsia-100 border-2 border-fuchsia-400 text-fuchsia-700", text: "26" },
];

export default function CalendarPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const contracts = generateYearContracts(selectedYear);

  // Get current trade period for highlighting
  const today = new Date();
  const todayStr = formatDateStr(today);

  return (
    <DashboardLayout>
      <Page
        title={`US Crude Oil Trading Calendar ${selectedYear}`}
        subtitle="WTI Futures contract dates, trade periods, and NYMEX holidays"
        toolbar={
          <>
            <Field label="Year" htmlFor="calendar-year">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className={BTN_SECONDARY}
                  aria-label="Previous year"
                >
                  ←
                </button>
                <select
                  id="calendar-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={`${SELECT} w-28 font-semibold`}
                >
                  {[2025, 2026, 2027, 2028].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className={BTN_SECONDARY}
                  aria-label="Next year"
                >
                  →
                </button>
              </div>
            </Field>
            <div className="flex flex-wrap items-center gap-2 pb-1 lg:ml-auto" aria-label="Legend">
              {LEGEND.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs text-slate-600"
                >
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold ${item.swatch}`}
                  >
                    {item.text}
                  </span>
                  {item.label}
                </span>
              ))}
            </div>
          </>
        }
      >
        {/* Calendar Grid: 1 → 2 → 3 → 4 → 6 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1760px]:grid-cols-6 gap-4">
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const weeks = generateMonthCalendar(selectedYear, monthIndex, contracts);

            return (
              <div key={monthIndex} className={`${CARD} overflow-hidden`}>
                {/* Month Header */}
                <div className="bg-slate-50 border-b border-line text-slate-800 px-3 py-2 text-center text-sm font-semibold">
                  {MONTH_NAMES[monthIndex]}
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {DAY_NAMES.map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1.5">
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
                        const extraClasses = isCurrentMonth && isTradeMonthBoundary ? "font-bold" : "";

                        if (isCurrentMonth) {
                          // Apply fuchsia styling for trade month boundaries (26th/25th)
                          if (isTradeMonthBoundary) {
                            textColor = "text-fuchsia-700";
                            bgColor = "bg-fuchsia-100";
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
                            bgColor = isTradeMonthBoundary ? "bg-fuchsia-100" : "bg-slate-100";
                            textColor = isTradeMonthBoundary ? "text-fuchsia-700" : "text-slate-400";
                          } else if (isTradeMonthBoundary) {
                            // Already set above, just need border
                            border = "border-l-2 border-r-2 border-fuchsia-400";
                          } else if (inTradePeriod) {
                            bgColor = "bg-blue-100";
                            border = "border-l-2 border-r-2 border-blue-400";
                          }
                        }

                        return (
                          <div
                            key={dayIndex}
                            className={`relative h-9 flex items-center justify-center text-sm font-medium tabular-nums ${bgColor} ${textColor} ${border} ${extraClasses}`}
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
        <Panel title={`${selectedYear} Contract Details`} flush>
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className={TH}>Contract</th>
                  <th className={TH}>Delivery</th>
                  <th className={TH}>Trade Period</th>
                  <th className={TH}>Last Trading</th>
                  <th className={TH}>First Notice</th>
                </tr>
              </thead>
              <tbody>
                {contracts.slice(0, 12).map((contract, i) => {
                  const monthCodes = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];
                  const code = `CL${monthCodes[contract.contractMonth]}${String(contract.contractYear).slice(-2)}`;
                  const isActive = today >= contract.tradeMonthStart && today <= contract.tradeMonthEnd;

                  return (
                    <tr key={i} className={isActive ? "bg-blue-50 hover:bg-blue-100/60 transition-colors" : TR}>
                      <td className={TD}>
                        <span className="font-mono font-semibold text-slate-800">{code}</span>
                      </td>
                      <td className={TD}>
                        {MONTH_NAMES[contract.contractMonth]} {contract.contractYear}
                      </td>
                      <td className={TD}>
                        <span className="text-slate-600">
                          {contract.tradeMonthStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {contract.tradeMonthEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-medium">
                          {contract.lastTradingDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </td>
                      <td className={TD}>
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
        </Panel>

        {/* Disclaimer */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
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
      </Page>
    </DashboardLayout>
  );
}

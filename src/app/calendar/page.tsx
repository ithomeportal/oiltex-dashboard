"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

interface ContractInfo {
  code: string;
  contractMonth: string;
  deliveryMonth: Date;
  lastTradingDay: Date;
  firstNoticeDay: Date;
  tradeMonthStart: Date;
  tradeMonthEnd: Date;
  status: "active" | "upcoming" | "expired";
}

// NYMEX holidays (approximate - major US holidays)
const NYMEX_HOLIDAYS_2026 = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-07-03", // Independence Day observed
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
];

const NYMEX_HOLIDAYS_2027 = [
  "2027-01-01", // New Year's Day
  "2027-01-18", // MLK Day
  "2027-02-15", // Presidents Day
  "2027-03-26", // Good Friday
  "2027-05-31", // Memorial Day
  "2027-07-05", // Independence Day observed
  "2027-09-06", // Labor Day
  "2027-11-25", // Thanksgiving
  "2027-12-24", // Christmas observed
];

const ALL_HOLIDAYS = new Set([...NYMEX_HOLIDAYS_2026, ...NYMEX_HOLIDAYS_2027]);

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  const dateStr = date.toISOString().split("T")[0];
  return !ALL_HOLIDAYS.has(dateStr);
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

// Calculate WTI CL contract dates
// Last Trading Day: 3 business days before the 25th of the month PRECEDING the contract month
// First Notice Day: 1 business day after Last Trading Day
function calculateContractDates(year: number, month: number): ContractInfo {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthCodes = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];

  // Contract month (delivery month)
  const deliveryMonth = new Date(year, month, 1);

  // Month preceding the contract month
  let precedingMonth = month - 1;
  let precedingYear = year;
  if (precedingMonth < 0) {
    precedingMonth = 11;
    precedingYear = year - 1;
  }

  // 25th of the preceding month
  const the25th = new Date(precedingYear, precedingMonth, 25);

  // Last Trading Day: 3 business days before the 25th
  const lastTradingDay = subtractBusinessDays(the25th, 3);

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

  // Determine status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let status: "active" | "upcoming" | "expired";
  if (lastTradingDay < today) {
    status = "expired";
  } else if (tradeMonthStart <= today && today <= tradeMonthEnd) {
    status = "active";
  } else {
    status = "upcoming";
  }

  const code = `CL${monthCodes[month]}${year.toString().slice(-2)}`;

  return {
    code,
    contractMonth: `${monthNames[month]} ${year}`,
    deliveryMonth,
    lastTradingDay,
    firstNoticeDay,
    tradeMonthStart,
    tradeMonthEnd,
    status,
  };
}

function generateCalendar(startYear: number, months: number): ContractInfo[] {
  const contracts: ContractInfo[] = [];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1); // Include last month

  for (let i = 0; i < months; i++) {
    const date = new Date(startYear, startDate.getMonth() + i, 1);
    contracts.push(calculateContractDates(date.getFullYear(), date.getMonth()));
  }

  return contracts;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const [showMonths, setShowMonths] = useState(12);
  const today = new Date();
  const contracts = generateCalendar(today.getFullYear(), showMonths);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Oil Trading Calendar</h1>
              <p className="text-slate-500 text-sm mt-1">
                WTI Crude Oil (CL) futures contract dates and trading periods
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={showMonths}
                onChange={(e) => setShowMonths(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
              >
                <option value={6}>Next 6 months</option>
                <option value={12}>Next 12 months</option>
                <option value={18}>Next 18 months</option>
                <option value={24}>Next 24 months</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-slate-600">Active Trade Month</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-600">Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-300"></div>
              <span className="text-sm text-slate-600">Expired</span>
            </div>
          </div>

          {/* Calendar Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Delivery Month
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Trade Period
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Last Trading Day
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      First Notice Day
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {contracts.map((contract, i) => (
                    <tr
                      key={contract.code}
                      className={`${
                        contract.status === "active"
                          ? "bg-green-50"
                          : contract.status === "expired"
                          ? "bg-slate-50"
                          : i % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-slate-800">
                          {contract.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800">
                        {contract.contractMonth}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(contract.tradeMonthStart)} - {formatDate(contract.tradeMonthEnd)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                        {formatDate(contract.lastTradingDay)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800">
                        {formatDate(contract.firstNoticeDay)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            contract.status === "active"
                              ? "bg-green-100 text-green-800"
                              : contract.status === "expired"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {contract.status === "active"
                            ? "Active"
                            : contract.status === "expired"
                            ? "Expired"
                            : "Upcoming"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Key Dates Explained
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Last Trading Day</dt>
                  <dd className="text-slate-500">
                    3 business days before the 25th of the month preceding the contract month.
                    Final day to trade the expiring contract.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">First Notice Day</dt>
                  <dd className="text-slate-500">
                    1 business day after Last Trading Day. Sellers can begin notifying buyers
                    of intent to deliver.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Trade Period</dt>
                  <dd className="text-slate-500">
                    For Argus pricing: runs from 26th of M-2 to 25th of M-1, where M is the
                    delivery month.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Contract Codes
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                WTI Crude Oil futures use the following month codes:
              </p>
              <div className="grid grid-cols-4 gap-2 text-sm">
                {[
                  { code: "F", month: "Jan" },
                  { code: "G", month: "Feb" },
                  { code: "H", month: "Mar" },
                  { code: "J", month: "Apr" },
                  { code: "K", month: "May" },
                  { code: "M", month: "Jun" },
                  { code: "N", month: "Jul" },
                  { code: "Q", month: "Aug" },
                  { code: "U", month: "Sep" },
                  { code: "V", month: "Oct" },
                  { code: "X", month: "Nov" },
                  { code: "Z", month: "Dec" },
                ].map((item) => (
                  <div key={item.code} className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-blue-600">{item.code}</span>
                    <span className="text-slate-600">{item.month}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Example: CLG26 = February 2026 WTI Crude Oil
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Dates are calculated programmatically based on CME Group rules.
              Always verify critical dates against the official CME Group calendar at{" "}
              <a
                href="https://www.cmegroup.com/tools-information/calendars/expiration-calendar.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                cmegroup.com
              </a>
              . Holiday schedules may affect actual trading dates.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

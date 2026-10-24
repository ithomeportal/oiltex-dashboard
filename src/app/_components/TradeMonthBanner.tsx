interface TradeMonthInfo {
  deliveryMonth: string;
  deliveryYear: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  totalDays: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getTradeMonthInfo(): TradeMonthInfo {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let tradeMonthStartMonth: number;
  let tradeMonthStartYear: number;
  let deliveryMonth: number;
  let deliveryYear: number;

  if (currentDay >= 26) {
    tradeMonthStartMonth = currentMonth;
    tradeMonthStartYear = currentYear;
    deliveryMonth = currentMonth + 2;
    deliveryYear = currentYear;
  } else {
    tradeMonthStartMonth = currentMonth - 1;
    tradeMonthStartYear = currentYear;
    if (tradeMonthStartMonth < 0) {
      tradeMonthStartMonth = 11;
      tradeMonthStartYear = currentYear - 1;
    }
    deliveryMonth = tradeMonthStartMonth + 2;
    deliveryYear = tradeMonthStartYear;
  }

  if (deliveryMonth > 11) {
    deliveryMonth = deliveryMonth - 12;
    deliveryYear = deliveryYear + 1;
  }

  let tradeMonthEndMonth = deliveryMonth - 1;
  let tradeMonthEndYear = deliveryYear;
  if (tradeMonthEndMonth < 0) {
    tradeMonthEndMonth = 11;
    tradeMonthEndYear = deliveryYear - 1;
  }

  const periodStartDate = new Date(tradeMonthStartYear, tradeMonthStartMonth, 26);
  const periodEndDate = new Date(tradeMonthEndYear, tradeMonthEndMonth, 25);

  let daysRemaining = 0;
  let totalDays = 0;
  const checkDate = new Date(periodStartDate);

  while (checkDate <= periodEndDate) {
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalDays++;
      if (checkDate > today) {
        daysRemaining++;
      }
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  const formatDate = (date: Date) => `${MONTH_NAMES[date.getMonth()].substring(0, 3)} ${date.getDate()}`;

  return {
    deliveryMonth: MONTH_NAMES[deliveryMonth],
    deliveryYear,
    periodStart: formatDate(periodStartDate),
    periodEnd: formatDate(periodEndDate),
    daysRemaining,
    totalDays,
  };
}

/** Slim navy accent strip — the one dark surface allowed in the dashboard body. */
export function TradeMonthBanner({ live }: { live: boolean }) {
  const tradeMonth = getTradeMonthInfo();
  return (
    <div className="bg-navy text-white">
      <div className="mx-auto w-full max-w-[1920px] px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Delivery</span>
            <span className="text-sm font-bold">
              {tradeMonth.deliveryMonth} {tradeMonth.deliveryYear}
            </span>
          </div>
          <span className="hidden sm:block h-4 w-px bg-white/20" />
          <span className="hidden sm:inline text-xs text-blue-100">
            Trade period {tradeMonth.periodStart} — {tradeMonth.periodEnd}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Trading days left</span>
            <span className="text-sm font-bold tabular-nums">{tradeMonth.daysRemaining}</span>
            <span className="text-xs text-blue-200 tabular-nums">/ {tradeMonth.totalDays}</span>
          </div>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

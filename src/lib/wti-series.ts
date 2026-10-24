// One outright WTI price per day for /analytics (history chart + annual stats).
//
// oil_prices also holds differentials (WTI_MIDLAND_DIFF ≈ +0.4), Houston prices and the
// CL2–CL4 strip. Ranking by source alone let a differential win on days with no
// outright price (2026-01-23..30, 2026-10-21/22 plotted at ~$0.38), so selection is
// by (source, price_type) pair. Order = preference when several exist for a day.
// Weekend-dated rows (INVESTING_COM weekly closes) are dropped: markets are closed, and
// they inflated the annual trading-day count (2025 showed 313).

export interface WtiSeries {
  source: string;
  priceType: string;
}

export const WTI_PRICE_SERIES: readonly WtiSeries[] = [
  { source: "NYMEX", priceType: "WTI_SETTLEMENT" },
  { source: "NYMEX", priceType: "WTI_FUTURES_SETTLE" },
  { source: "NYMEX_EIA", priceType: "WTI_FUTURES_CL1" },
  { source: "CHART_EXPORT", priceType: "WTI_HISTORICAL" },
  { source: "INVESTING_COM", priceType: "WTI_FUTURES_CLOSE" },
  { source: "EIA", priceType: "WTI_CUSHING_SPOT" },
  { source: "FRED", priceType: "WTI_SPOT_DCOILWTICO" },
  { source: "YAHOO", priceType: "WTI_FUTURES_CL" },
];

/**
 * SQL yielding `date, value` — one ranked WTI price per day before today.
 * `extraFilter` must be server-built (e.g. a date bound), never user input.
 */
export function wtiDailySeriesSql(extraFilter = ""): string {
  const pairs = WTI_PRICE_SERIES.map((s) => `('${s.source}', '${s.priceType}')`).join(", ");
  const ranks = WTI_PRICE_SERIES.map(
    (s, i) => `WHEN source = '${s.source}' AND price_type = '${s.priceType}' THEN ${i + 1}`,
  ).join("\n          ");
  return `
    WITH ranked_prices AS (
      SELECT
        date,
        value,
        ROW_NUMBER() OVER (
          PARTITION BY date
          ORDER BY CASE
          ${ranks}
          END
        ) AS rn
      FROM oil_prices
      WHERE value IS NOT NULL
        AND (source, price_type) IN (${pairs})
        AND date < CURRENT_DATE
        AND EXTRACT(ISODOW FROM date) < 6
        ${extraFilter}
    )
    SELECT date, value
    FROM ranked_prices
    WHERE rn = 1`;
}

export interface PriceData {
  date: string;
  value: number | null;
  source: string;
  priceType: string;
}

export interface LivePrices {
  eia: PriceData[];
  fred: PriceData[];
  yahooFutures: PriceData[];
  yahooMidland: PriceData[];
  nymex: PriceData[];
  chartExport: PriceData[];
  investingCom: PriceData[];
  argusHouston: PriceData[];
  fetchedAt: string;
}

export interface WellBreakdown {
  shipper_name: string;
  ticket_count: number;
  delivered_bbls: number;
}

export interface ArgusPricingLatest {
  nymex_cma_td: number | null;
  cma_diff_mtd: number | null;
  midland_diff_mtd: number | null;
  est_net_mtd: number | null;
  wtl_midland_wtd_avg: number | null;
  report_date: string;
  contract_month: string;
}

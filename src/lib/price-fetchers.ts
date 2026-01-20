// Price fetching services for different data sources

export interface PriceData {
  date: string;
  value: number | null;
  source: string;
  priceType: string;
}

// EIA API - WTI Cushing Spot Price (RWTC)
export async function fetchEIAPrices(days: number = 30): Promise<PriceData[]> {
  const apiKey = process.env.EIA_API_KEY;
  const url = new URL("https://api.eia.gov/v2/petroleum/pri/spt/data");
  url.searchParams.append("api_key", apiKey || "");
  url.searchParams.append("frequency", "daily");
  url.searchParams.append("data[0]", "value");
  url.searchParams.append("facets[series][]", "RWTC");
  url.searchParams.append("sort[0][column]", "period");
  url.searchParams.append("sort[0][direction]", "desc");
  url.searchParams.append("length", days.toString());

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!data.response?.data) {
    console.error("EIA API error:", data);
    return [];
  }

  return data.response.data.map((item: { period: string; value: string }) => ({
    date: item.period,
    value: item.value ? parseFloat(item.value) : null,
    source: "EIA",
    priceType: "WTI_CUSHING_SPOT",
  }));
}

// FRED API - DCOILWTICO (WTI Spot Price)
export async function fetchFREDPrices(days: number = 30): Promise<PriceData[]> {
  const apiKey = process.env.FRED_API_KEY;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DCOILWTICO&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${days}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.observations) {
    console.error("FRED API error:", data);
    return [];
  }

  return data.observations
    .filter((item: { value: string }) => item.value !== ".")
    .map((item: { date: string; value: string }) => ({
      date: item.date,
      value: item.value !== "." ? parseFloat(item.value) : null,
      source: "FRED",
      priceType: "WTI_SPOT_DCOILWTICO",
    }));
}

// Yahoo Finance - WTI Crude Futures (CL=F)
export async function fetchYahooWTIFutures(
  days: number = 30
): Promise<PriceData[]> {
  const range = days <= 5 ? "5d" : days <= 30 ? "1mo" : "3mo";
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=${range}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });
  const data = await response.json();

  if (data.chart?.error || !data.chart?.result?.[0]) {
    console.error("Yahoo Finance API error:", data.chart?.error);
    return [];
  }

  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  return timestamps.map((ts: number, i: number) => {
    const date = new Date(ts * 1000);
    const dateStr = date.toISOString().split("T")[0];
    return {
      date: dateStr,
      value: closes[i] ? parseFloat(closes[i].toFixed(2)) : null,
      source: "YAHOO",
      priceType: "WTI_FUTURES_CL",
    };
  });
}

// Yahoo Finance - WTI Midland vs WTI Differential (WTT=F)
export async function fetchYahooMidlandDiff(
  days: number = 30
): Promise<PriceData[]> {
  const range = days <= 5 ? "5d" : days <= 30 ? "1mo" : "3mo";
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/WTT=F?interval=1d&range=${range}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });
  const data = await response.json();

  if (data.chart?.error || !data.chart?.result?.[0]) {
    console.error("Yahoo Finance Midland API error:", data.chart?.error);
    return [];
  }

  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  return timestamps.map((ts: number, i: number) => {
    const date = new Date(ts * 1000);
    const dateStr = date.toISOString().split("T")[0];
    return {
      date: dateStr,
      value: closes[i] ? parseFloat(closes[i].toFixed(4)) : null,
      source: "YAHOO",
      priceType: "WTI_MIDLAND_DIFF",
    };
  });
}

// Fetch all prices from all sources
export async function fetchAllPrices(days: number = 30) {
  const [eiaPrices, fredPrices, yahooFutures, yahooMidland] = await Promise.all(
    [
      fetchEIAPrices(days),
      fetchFREDPrices(days),
      fetchYahooWTIFutures(days),
      fetchYahooMidlandDiff(days),
    ]
  );

  return {
    eia: eiaPrices,
    fred: fredPrices,
    yahooFutures,
    yahooMidland,
    fetchedAt: new Date().toISOString(),
  };
}

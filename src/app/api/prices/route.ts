import { NextResponse } from "next/server";
import { fetchAllPrices } from "@/lib/price-fetchers";
import { getLatestPrices, calculateCMA } from "@/lib/db";

// Normalize date to YYYY-MM-DD format
function normalizeDate(dateInput: string | Date): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

// Transform flat database rows into grouped format expected by frontend
function transformDbPrices(rows: Array<{ date: string; source: string; price_type: string; value: number | null }>) {
  const eia: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const fred: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const yahooFutures: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const yahooMidland: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const nymex: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const chartExport: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];
  const investingCom: Array<{ date: string; value: number | null; source: string; priceType: string }> = [];

  for (const row of rows) {
    const normalizedDate = normalizeDate(row.date);
    if (!normalizedDate) continue; // Skip rows with invalid dates

    const priceData = {
      date: normalizedDate, // Properly normalized YYYY-MM-DD format
      value: row.value ? parseFloat(String(row.value)) : null,
      source: row.source,
      priceType: row.price_type,
    };

    if (row.source === "EIA") {
      eia.push(priceData);
    } else if (row.source === "FRED") {
      fred.push(priceData);
    } else if (row.source === "YAHOO" && row.price_type === "WTI_FUTURES_CL") {
      yahooFutures.push(priceData);
    } else if (row.source === "YAHOO" && row.price_type === "WTI_MIDLAND_DIFF") {
      yahooMidland.push(priceData);
    } else if (row.source === "NYMEX" || row.source === "NYMEX_EIA") {
      nymex.push(priceData);
    } else if (row.source === "CHART_EXPORT") {
      chartExport.push(priceData);
    } else if (row.source === "INVESTING_COM") {
      investingCom.push(priceData);
    }
  }

  return {
    eia,
    fred,
    yahooFutures,
    yahooMidland,
    nymex,
    chartExport,
    investingCom,
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source"); // 'live', 'db', or 'both'
  const days = parseInt(searchParams.get("days") || "30");

  try {
    if (source === "live") {
      // Fetch fresh data from APIs (fallback, for manual refresh)
      const prices = await fetchAllPrices(days);
      return NextResponse.json({ success: true, data: prices });
    } else {
      // Default: Get stored data from database (recommended)
      const dbRows = await getLatestPrices(days);
      const prices = transformDbPrices(dbRows);
      return NextResponse.json({ success: true, data: prices });
    }
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

// Calculate CMA for a specific month
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, source } = body;

    if (!month || !source) {
      return NextResponse.json(
        { success: false, error: "Month and source are required" },
        { status: 400 }
      );
    }

    const cma = await calculateCMA(month, source);
    return NextResponse.json({ success: true, data: cma });
  } catch (error) {
    console.error("Error calculating CMA:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate CMA" },
      { status: 500 }
    );
  }
}

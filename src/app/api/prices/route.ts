import { NextResponse } from "next/server";
import { fetchAllPrices } from "@/lib/price-fetchers";
import { getLatestPrices, calculateCMA } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source"); // 'live', 'db', or 'both'
  const days = parseInt(searchParams.get("days") || "30");

  try {
    if (source === "live") {
      // Fetch fresh data from APIs
      const prices = await fetchAllPrices(days);
      return NextResponse.json({ success: true, data: prices });
    } else if (source === "db") {
      // Get stored data from database
      const prices = await getLatestPrices(days);
      return NextResponse.json({ success: true, data: prices });
    } else {
      // Default: fetch both and compare
      const [livePrices, dbPrices] = await Promise.all([
        fetchAllPrices(days),
        getLatestPrices(days),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          live: livePrices,
          stored: dbPrices,
        },
      });
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

import { NextResponse } from "next/server";
import { fetchAllPrices } from "@/lib/price-fetchers";
import { savePrice, initDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for Vercel

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Initialize database tables if they don't exist
    await initDatabase();

    // Fetch prices from all sources (last 7 days to catch any missed days)
    const prices = await fetchAllPrices(7);
    let savedCount = 0;

    // Save EIA prices
    for (const price of prices.eia) {
      if (price.value !== null) {
        await savePrice(
          price.date,
          price.source,
          price.priceType,
          price.value
        );
        savedCount++;
      }
    }

    // Save FRED prices
    for (const price of prices.fred) {
      if (price.value !== null) {
        await savePrice(
          price.date,
          price.source,
          price.priceType,
          price.value
        );
        savedCount++;
      }
    }

    // Save Yahoo Futures prices
    for (const price of prices.yahooFutures) {
      if (price.value !== null) {
        await savePrice(
          price.date,
          price.source,
          price.priceType,
          price.value
        );
        savedCount++;
      }
    }

    // Save Yahoo Midland Differential prices
    for (const price of prices.yahooMidland) {
      if (price.value !== null) {
        await savePrice(
          price.date,
          price.source,
          price.priceType,
          price.value
        );
        savedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fetched and saved ${savedCount} price records`,
      fetchedAt: prices.fetchedAt,
      counts: {
        eia: prices.eia.length,
        fred: prices.fred.length,
        yahooFutures: prices.yahooFutures.length,
        yahooMidland: prices.yahooMidland.length,
      },
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { success: false, error: "Cron job failed" },
      { status: 500 }
    );
  }
}

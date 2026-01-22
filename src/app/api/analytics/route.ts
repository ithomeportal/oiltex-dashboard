import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface AnnualData {
  year: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  tradingDays: number;
  percentChange: number | null;
}

interface HistoricalPoint {
  date: string;
  price: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "annual"; // 'annual' or 'historical'
  const range = searchParams.get("range") || "all"; // 'ytd', '1y', '5y', '10y', 'all'

  const client = await pool.connect();

  try {
    if (type === "annual") {
      // Get annual averages and statistics
      const result = await client.query(`
        SELECT
          EXTRACT(YEAR FROM date) as year,
          AVG(value) as avg_price,
          MIN(value) as min_price,
          MAX(value) as max_price,
          COUNT(*) as trading_days
        FROM oil_prices
        WHERE value IS NOT NULL
          AND source IN ('NYMEX', 'NYMEX_EIA', 'CHART_EXPORT', 'EIA')
          AND date < CURRENT_DATE
        GROUP BY EXTRACT(YEAR FROM date)
        ORDER BY year ASC
      `);

      // Calculate year-over-year percent change
      const annualData: AnnualData[] = result.rows.map((row, index) => {
        const prevYear = index > 0 ? result.rows[index - 1] : null;
        const percentChange = prevYear
          ? ((parseFloat(row.avg_price) - parseFloat(prevYear.avg_price)) / parseFloat(prevYear.avg_price)) * 100
          : null;

        return {
          year: parseInt(row.year),
          avgPrice: parseFloat(parseFloat(row.avg_price).toFixed(2)),
          minPrice: parseFloat(parseFloat(row.min_price).toFixed(2)),
          maxPrice: parseFloat(parseFloat(row.max_price).toFixed(2)),
          tradingDays: parseInt(row.trading_days),
          percentChange: percentChange !== null ? parseFloat(percentChange.toFixed(2)) : null,
        };
      });

      return NextResponse.json({ success: true, data: annualData });
    } else if (type === "historical") {
      // Get historical daily data based on range
      let dateFilter = "";
      const now = new Date();

      switch (range) {
        case "ytd":
          dateFilter = `AND date >= '${now.getFullYear()}-01-01'`;
          break;
        case "1y":
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          dateFilter = `AND date >= '${oneYearAgo.toISOString().split("T")[0]}'`;
          break;
        case "5y":
          const fiveYearsAgo = new Date(now);
          fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
          dateFilter = `AND date >= '${fiveYearsAgo.toISOString().split("T")[0]}'`;
          break;
        case "10y":
          const tenYearsAgo = new Date(now);
          tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
          dateFilter = `AND date >= '${tenYearsAgo.toISOString().split("T")[0]}'`;
          break;
        default:
          dateFilter = ""; // All data
      }

      // Get one price per day (prefer NYMEX, fallback to others)
      const result = await client.query(`
        WITH ranked_prices AS (
          SELECT
            date,
            value,
            source,
            ROW_NUMBER() OVER (
              PARTITION BY date
              ORDER BY CASE source
                WHEN 'NYMEX' THEN 1
                WHEN 'NYMEX_EIA' THEN 2
                WHEN 'CHART_EXPORT' THEN 3
                WHEN 'INVESTING_COM' THEN 4
                WHEN 'EIA' THEN 5
                ELSE 6
              END
            ) as rn
          FROM oil_prices
          WHERE value IS NOT NULL
            AND date < CURRENT_DATE
            ${dateFilter}
        )
        SELECT date, value as price
        FROM ranked_prices
        WHERE rn = 1
        ORDER BY date ASC
      `);

      const historicalData: HistoricalPoint[] = result.rows.map((row) => ({
        date: new Date(row.date).toISOString().split("T")[0],
        price: parseFloat(parseFloat(row.price).toFixed(2)),
      }));

      return NextResponse.json({ success: true, data: historicalData });
    }

    return NextResponse.json({ success: false, error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch analytics data" }, { status: 500 });
  } finally {
    client.release();
  }
}

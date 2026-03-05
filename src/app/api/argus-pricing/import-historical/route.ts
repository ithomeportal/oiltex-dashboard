import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// POST /api/argus-pricing/import-historical
// Body: { data: Array<{ report_date, contract_month, nymex_cma_td, ... }>, source: "file3"|"file2" }
// Auth: CRON_SECRET
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, source } = body;

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "No data provided" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (source === "file3") {
      // Phase 1: Import argus_pricing + oil_prices from File 3
      for (const row of data) {
        // Insert into argus_pricing (NYMEX CMA, CMA diffs — no Midland data in these files)
        const estNetDaily =
          row.nymex_cma_td != null && row.cma_diff_daily != null
            ? row.nymex_cma_td + row.cma_diff_daily
            : null;
        const estNetMtd =
          row.nymex_cma_td != null && row.cma_diff_mtd != null
            ? row.nymex_cma_td + row.cma_diff_mtd
            : null;

        const result = await client.query(
          `INSERT INTO argus_pricing (
            report_date, contract_month, nymex_cma_td,
            cma_diff_daily, cma_diff_mtd,
            midland_diff_daily, midland_diff_mtd,
            est_net_daily, est_net_mtd,
            extraction_confidence, raw_extraction
          ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, 100, $8)
          ON CONFLICT (report_date, contract_month)
          DO UPDATE SET
            nymex_cma_td = COALESCE(EXCLUDED.nymex_cma_td, argus_pricing.nymex_cma_td),
            cma_diff_daily = COALESCE(EXCLUDED.cma_diff_daily, argus_pricing.cma_diff_daily),
            cma_diff_mtd = COALESCE(EXCLUDED.cma_diff_mtd, argus_pricing.cma_diff_mtd),
            est_net_daily = COALESCE(EXCLUDED.est_net_daily, argus_pricing.est_net_daily),
            est_net_mtd = COALESCE(EXCLUDED.est_net_mtd, argus_pricing.est_net_mtd)
          RETURNING (xmax = 0) AS is_insert`,
          [
            row.report_date,
            row.contract_month,
            row.nymex_cma_td,
            row.cma_diff_daily,
            row.cma_diff_mtd,
            estNetDaily,
            estNetMtd,
            JSON.stringify({
              source: "argus_historical_excel",
              file: "Argus Historical Prices3.xlsx",
              imported_at: new Date().toISOString(),
            }),
          ]
        );

        if (result.rows[0]?.is_insert) {
          inserted++;
        } else {
          updated++;
        }

        // Also insert NYMEX settlement into oil_prices
        if (row.nymex_settlement != null) {
          await client.query(
            `INSERT INTO oil_prices (date, source, price_type, value, unit)
             VALUES ($1, 'NYMEX', 'WTI_FUTURES_SETTLE', $2, '$/BBL')
             ON CONFLICT (date, source, price_type) DO UPDATE SET value = EXCLUDED.value`,
            [row.report_date, row.nymex_settlement]
          );
        }
      }
    } else if (source === "file2") {
      // Phase 2: Import WTI Houston into oil_prices
      for (const row of data) {
        if (row.wti_houston_price != null) {
          const result = await client.query(
            `INSERT INTO oil_prices (date, source, price_type, value, unit)
             VALUES ($1, 'ARGUS', 'WTI_HOUSTON_WTD_AVG', $2, '$/BBL')
             ON CONFLICT (date, source, price_type) DO UPDATE SET value = EXCLUDED.value
             RETURNING (xmax = 0) AS is_insert`,
            [row.report_date, row.wti_houston_price]
          );
          if (result.rows[0]?.is_insert) {
            inserted++;
          } else {
            updated++;
          }
        }

        if (row.wti_houston_diff != null) {
          await client.query(
            `INSERT INTO oil_prices (date, source, price_type, value, unit)
             VALUES ($1, 'ARGUS', 'WTI_HOUSTON_DIFF', $2, '$/BBL')
             ON CONFLICT (date, source, price_type) DO UPDATE SET value = EXCLUDED.value`,
            [row.report_date, row.wti_houston_diff]
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: "Invalid source. Use 'file3' or 'file2'" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
      total: data.length,
      inserted,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

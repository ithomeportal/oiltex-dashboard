import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { queryMcLeod } from "@/lib/mcleod-db";

// GET /api/argus-pricing/profit?delivery_month=2026-02
// Calculates Buy (Devon) / Sell (Marathon) / Profit for a given delivery month
export async function GET(request: NextRequest) {
  const deliveryMonth = request.nextUrl.searchParams.get("delivery_month");
  if (!deliveryMonth || !/^\d{4}-\d{2}$/.test(deliveryMonth)) {
    return NextResponse.json(
      { success: false, error: "delivery_month required (YYYY-MM)" },
      { status: 400 }
    );
  }

  const [year, month] = deliveryMonth.split("-").map(Number);

  // Devon period: delivery month trading days (e.g., Feb 1-28)
  const devonStart = `${deliveryMonth}-01`;
  const devonEnd = new Date(year, month, 0).toISOString().split("T")[0]; // last day of month

  // Marathon period: day 26, 2 months prior through day 25, 1 month prior
  // For Feb delivery: Dec 26 – Jan 25
  const marathonStartDate = new Date(year, month - 3, 26); // 2 months prior, day 26
  const marathonEndDate = new Date(year, month - 2, 25); // 1 month prior, day 25
  const marathonStart = marathonStartDate.toISOString().split("T")[0];
  const marathonEnd = marathonEndDate.toISOString().split("T")[0];

  const client = await pool.connect();
  try {
    // Marathon period averages
    const marathonCmaResult = await client.query(
      `SELECT AVG(cma_diff_daily) as avg_val, COUNT(*) as days
       FROM argus_pricing
       WHERE report_date >= $1 AND report_date <= $2 AND cma_diff_daily IS NOT NULL`,
      [marathonStart, marathonEnd]
    );

    const marathonMidResult = await client.query(
      `SELECT AVG(value) as avg_val, COUNT(*) as days
       FROM oil_prices
       WHERE source = 'ARGUS' AND price_type = 'WTI_MIDLAND_DIFF'
       AND date >= $1 AND date <= $2 AND value IS NOT NULL`,
      [marathonStart, marathonEnd]
    );

    // Devon period averages
    const devonCmaResult = await client.query(
      `SELECT AVG(cma_diff_daily) as avg_val, COUNT(*) as days
       FROM argus_pricing
       WHERE report_date >= $1 AND report_date <= $2 AND cma_diff_daily IS NOT NULL`,
      [devonStart, devonEnd]
    );

    const devonMidResult = await client.query(
      `SELECT AVG(value) as avg_val, COUNT(*) as days
       FROM oil_prices
       WHERE source = 'ARGUS' AND price_type = 'WTI_MIDLAND_DIFF'
       AND date >= $1 AND date <= $2 AND value IS NOT NULL`,
      [devonStart, devonEnd]
    );

    // NYMEX CMA for delivery month (base price, same for both)
    const nymexResult = await client.query(
      `SELECT AVG(value) as avg_val, COUNT(*) as days
       FROM oil_prices
       WHERE source = 'NYMEX' AND price_type = 'WTI_FUTURES_SETTLE'
       AND date >= $1 AND date <= $2 AND value IS NOT NULL`,
      [devonStart, devonEnd]
    );

    // Volume from tickets
    const volumeResult = await client.query(
      `SELECT COUNT(*) as ticket_count,
              COALESCE(SUM(delivered_bbls::numeric), 0) as delivered_bbls,
              COALESCE(SUM(net_barrels::numeric), 0) as net_barrels
       FROM oil_tickets
       WHERE ticket_date >= $1 AND ticket_date <= $2`,
      [devonStart, devonEnd]
    );

    // Actual freight costs from McLeod transport orders
    const freightResult = await queryMcLeod(
      `SELECT
         COUNT(*) as order_count,
         COALESCE(SUM(total_charge), 0) as total_freight,
         COALESCE(SUM(freight_charge), 0) as freight_only,
         COALESCE(SUM(other_charge), 0) as other_charges,
         COALESCE(SUM(total_carrier_pay), 0) as carrier_pay
       FROM public.mcleod_gld_budget_report_v4
       WHERE customer_name ILIKE '%OILTEX%'
       AND ordered_date >= $1 AND ordered_date <= $2`,
      [devonStart, devonEnd]
    );

    const marathonCmaDiff = marathonCmaResult.rows[0].avg_val
      ? parseFloat(marathonCmaResult.rows[0].avg_val)
      : null;
    const marathonMidDiff = marathonMidResult.rows[0].avg_val
      ? parseFloat(marathonMidResult.rows[0].avg_val)
      : null;
    const devonCmaDiff = devonCmaResult.rows[0].avg_val
      ? parseFloat(devonCmaResult.rows[0].avg_val)
      : null;
    const devonMidDiff = devonMidResult.rows[0].avg_val
      ? parseFloat(devonMidResult.rows[0].avg_val)
      : null;
    const nymexCma = nymexResult.rows[0].avg_val
      ? parseFloat(nymexResult.rows[0].avg_val)
      : null;

    const deliveredBbls = parseFloat(volumeResult.rows[0].delivered_bbls);
    const netBarrels = parseFloat(volumeResult.rows[0].net_barrels);
    const ticketCount = parseInt(volumeResult.rows[0].ticket_count, 10);

    const freightRow = freightResult.rows[0];
    const totalFreight = parseFloat(freightRow.total_freight as string);
    const freightOrders = parseInt(freightRow.order_count as string, 10);
    const freightPerBbl = deliveredBbls > 0 ? totalFreight / deliveredBbls : null;

    const fixedDeduction = 0.25;

    // Sell price (Marathon) = NYMEX CMA - $0.25 + Marathon CMA Diff + Marathon WTI Midland Diff
    const sellPrice =
      nymexCma !== null && marathonCmaDiff !== null && marathonMidDiff !== null
        ? nymexCma - fixedDeduction + marathonCmaDiff + marathonMidDiff
        : null;

    // Buy price (Devon) = NYMEX CMA + Devon CMA Diff + Devon WTI Midland Diff - Transport
    // Transport is per-lease, returned separately for client to apply
    const buyPriceBeforeTransport =
      nymexCma !== null && devonCmaDiff !== null && devonMidDiff !== null
        ? nymexCma + devonCmaDiff + devonMidDiff
        : null;

    // Net delta (base cancels): profit per bbl before transport
    const netDelta =
      marathonCmaDiff !== null &&
      marathonMidDiff !== null &&
      devonCmaDiff !== null &&
      devonMidDiff !== null
        ? (marathonCmaDiff + marathonMidDiff) -
          (devonCmaDiff + devonMidDiff) -
          fixedDeduction
        : null;

    return NextResponse.json({
      success: true,
      data: {
        delivery_month: deliveryMonth,
        nymex_cma: nymexCma,
        fixed_deduction: fixedDeduction,
        marathon: {
          period: { start: marathonStart, end: marathonEnd },
          cma_diff_avg: marathonCmaDiff,
          wti_midland_diff_avg: marathonMidDiff,
          trading_days: parseInt(marathonCmaResult.rows[0].days, 10),
          sell_price: sellPrice,
        },
        devon: {
          period: { start: devonStart, end: devonEnd },
          cma_diff_avg: devonCmaDiff,
          wti_midland_diff_avg: devonMidDiff,
          trading_days: parseInt(devonCmaResult.rows[0].days, 10),
          buy_price_before_transport: buyPriceBeforeTransport,
        },
        net_delta_before_transport: netDelta,
        volume: {
          ticket_count: ticketCount,
          delivered_bbls: deliveredBbls,
          net_barrels: netBarrels,
          shrinkage: netBarrels - deliveredBbls,
        },
        freight: {
          order_count: freightOrders,
          total_cost: totalFreight,
          freight_only: parseFloat(freightRow.freight_only as string),
          other_charges: parseFloat(freightRow.other_charges as string),
          carrier_pay: parseFloat(freightRow.carrier_pay as string),
          cost_per_bbl: freightPerBbl,
        },
      },
    });
  } catch (error) {
    console.error("Profit calculation error:", error);
    return NextResponse.json(
      { success: false, error: "Calculation failed", details: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

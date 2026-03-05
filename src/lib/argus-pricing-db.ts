import pool from "./db";
import type { ArgusPricingData } from "./argus-extractor";

export interface ArgusPricingRow {
  id: number;
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  est_net_daily: number | null;
  est_net_mtd: number | null;
  extraction_confidence: number | null;
  raw_extraction: Record<string, unknown> | null;
  created_at: string;
}

export async function saveArgusPricing(
  reportDate: string,
  data: ArgusPricingData,
  rawExtraction: Record<string, unknown>
): Promise<ArgusPricingRow | null> {
  const client = await pool.connect();
  try {
    // Compute estimated net values (NYMEX CMA TD + CMA Diff + Midland Diff)
    const estNetDaily =
      data.nymex_cma_td !== null &&
      data.cma_diff_daily !== null &&
      data.midland_diff_daily !== null
        ? data.nymex_cma_td + data.cma_diff_daily + data.midland_diff_daily
        : null;

    const estNetMtd =
      data.nymex_cma_td !== null &&
      data.cma_diff_mtd !== null &&
      data.midland_diff_mtd !== null
        ? data.nymex_cma_td + data.cma_diff_mtd + data.midland_diff_mtd
        : null;

    const contractMonth = data.contract_month || reportDate.substring(0, 7);

    const result = await client.query(
      `INSERT INTO argus_pricing (
        report_date, contract_month, nymex_cma_td,
        cma_diff_daily, cma_diff_mtd,
        midland_diff_daily, midland_diff_mtd,
        est_net_daily, est_net_mtd,
        extraction_confidence, raw_extraction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (report_date, contract_month)
      DO UPDATE SET
        nymex_cma_td = EXCLUDED.nymex_cma_td,
        cma_diff_daily = EXCLUDED.cma_diff_daily,
        cma_diff_mtd = EXCLUDED.cma_diff_mtd,
        midland_diff_daily = EXCLUDED.midland_diff_daily,
        midland_diff_mtd = EXCLUDED.midland_diff_mtd,
        est_net_daily = EXCLUDED.est_net_daily,
        est_net_mtd = EXCLUDED.est_net_mtd,
        extraction_confidence = EXCLUDED.extraction_confidence,
        raw_extraction = EXCLUDED.raw_extraction
      RETURNING *`,
      [
        reportDate,
        contractMonth,
        data.nymex_cma_td,
        data.cma_diff_daily,
        data.cma_diff_mtd,
        data.midland_diff_daily,
        data.midland_diff_mtd,
        estNetDaily,
        estNetMtd,
        data.extraction_confidence,
        JSON.stringify(rawExtraction),
      ]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getArgusPricingByMonth(
  month: string,
  limit: number = 31,
  offset: number = 0
): Promise<ArgusPricingRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM argus_pricing
       WHERE contract_month = $1
       ORDER BY report_date DESC
       LIMIT $2 OFFSET $3`,
      [month, limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getLatestArgusPricing(
  month?: string
): Promise<ArgusPricingRow | null> {
  const client = await pool.connect();
  try {
    const query = month
      ? `SELECT * FROM argus_pricing WHERE contract_month = $1 ORDER BY report_date DESC LIMIT 1`
      : `SELECT * FROM argus_pricing ORDER BY report_date DESC LIMIT 1`;
    const params = month ? [month] : [];
    const result = await client.query(query, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getAvailableContractMonths(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT contract_month FROM argus_pricing ORDER BY contract_month DESC`
    );
    return result.rows.map((r: { contract_month: string }) => r.contract_month);
  } finally {
    client.release();
  }
}

export async function getArgusPricingCount(month?: string): Promise<number> {
  const client = await pool.connect();
  try {
    const query = month
      ? `SELECT COUNT(*) as count FROM argus_pricing WHERE contract_month = $1`
      : `SELECT COUNT(*) as count FROM argus_pricing`;
    const params = month ? [month] : [];
    const result = await client.query(query, params);
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

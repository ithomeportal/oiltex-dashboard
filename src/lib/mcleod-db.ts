import { Pool, type QueryResult, type QueryResultRow } from "pg";

// Prefer an explicit DATALAKE_DATABASE_URL backed by its own least-privilege role
// (oiltex_gold_ro, SELECT on public.mcleod_gld_budget_report_v4 only).
//
// This pool used to reuse the PRIMARY database credentials while hardcoding a
// different database name — the same "reach database B with database A's
// credential" mistake as a URL rewrite, just spelled differently. It worked only
// while one account could read everything; after the 2026-07-20 least-privilege
// migration `oiltex_rw` had no grants in the datalake and every query here failed
// with SQLSTATE 42501, taking out /api/ops-inventory/transport-orders and the
// Buy/Sell/Profit calculation in /api/argus-pricing/profit.
//
// sslmode in the URL overrides the `ssl` object below and fails Aiven's chain
// (SELF_SIGNED_CERT_IN_CHAIN), so strip it in any position.
function stripSslMode(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?")
    .replace(/&&/g, "&");
}

const explicitDatalakeUrl = process.env.DATALAKE_DATABASE_URL;

const mcleodPool = new Pool(
  explicitDatalakeUrl
    ? {
        connectionString: stripSslMode(explicitDatalakeUrl),
        ssl: { rejectUnauthorized: false },
      }
    : {
        // Legacy fallback for local development only. Production must set
        // DATALAKE_DATABASE_URL — never reach the datalake with the primary
        // application credentials.
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || "10261"),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: "aivn_datalake_gold",
        ssl: { rejectUnauthorized: false },
      }
);

export async function queryMcLeod<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number | null)[]
): Promise<QueryResult<T>> {
  const client = await mcleodPool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

export interface TransportOrder {
  readonly id: string;
  readonly ordered_date: string | null;
  readonly status: string | null;
  readonly customer_name: string | null;
  readonly origin_name: string | null;
  readonly origin_city_name: string | null;
  readonly origin_state_id: string | null;
  readonly dest_name: string | null;
  readonly dest_city_name: string | null;
  readonly dest_state_id: string | null;
  readonly bill_distance: number | null;
  readonly equipment_type_descr: string | null;
  readonly freight_charge: number | null;
  readonly other_charge: number | null;
  readonly total_charge: number | null;
  readonly total_carrier_pay: number | null;
  readonly margin_amt: number | null;
  readonly margin_prcnt: number | null;
  readonly bill_date: string | null;
  readonly ready_to_bill: string | null;
}

export interface TransportOrderFilters {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

export async function getTransportOrders(
  filters: TransportOrderFilters = {}
): Promise<{ orders: ReadonlyArray<TransportOrder>; total: number }> {
  const conditions: string[] = ["customer_name ILIKE '%OILTEX%'"];
  const params: (string | number)[] = [];

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`ordered_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`ordered_date <= $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(origin_name ILIKE $${params.length} OR dest_name ILIKE $${params.length} OR origin_city_name ILIKE $${params.length} OR dest_city_name ILIKE $${params.length} OR id::text ILIKE $${params.length})`
    );
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  const countResult = await queryMcLeod(
    `SELECT COUNT(*) FROM public.mcleod_gld_budget_report_v4 ${where}`,
    params
  );

  const dataParams = [...params, limit, offset];
  const result = await queryMcLeod<TransportOrder>(
    `SELECT
       id,
       ordered_date,
       status,
       customer_name,
       origin_name,
       origin_city_name,
       origin_state_id,
       dest_name,
       dest_city_name,
       dest_state_id,
       bill_distance,
       equipment_type_descr,
       freight_charge,
       other_charge,
       total_charge,
       total_carrier_pay,
       margin_amt,
       margin_prcnt,
       bill_date,
       ready_to_bill
     FROM public.mcleod_gld_budget_report_v4
     ${where}
     ORDER BY ordered_date DESC, id DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return {
    orders: result.rows,
    total: parseInt(countResult.rows[0].count as string, 10),
  };
}

export interface TransportOrderSummary {
  readonly total_orders: number;
  readonly total_charges: number;
  readonly total_carrier_pay: number;
  readonly avg_margin_pct: number | null;
}

export async function getTransportOrderSummary(
  filters: Pick<TransportOrderFilters, "dateFrom" | "dateTo" | "status"> = {}
): Promise<TransportOrderSummary> {
  const conditions: string[] = ["customer_name ILIKE '%OILTEX%'"];
  const params: (string | number)[] = [];

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`ordered_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`ordered_date <= $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const result = await queryMcLeod(
    `SELECT
       COUNT(*) as total_orders,
       COALESCE(SUM(total_charge), 0) as total_charges,
       COALESCE(SUM(total_carrier_pay), 0) as total_carrier_pay,
       AVG(margin_prcnt) as avg_margin_pct
     FROM public.mcleod_gld_budget_report_v4
     ${where}`,
    params
  );

  const row = result.rows[0];
  return {
    total_orders: parseInt(row.total_orders as string, 10),
    total_charges: parseFloat(row.total_charges as string),
    total_carrier_pay: parseFloat(row.total_carrier_pay as string),
    avg_margin_pct: row.avg_margin_pct ? parseFloat(row.avg_margin_pct as string) : null,
  };
}

import pool from "./db";
import type {
  OilTicketUpload,
  OilTicket,
  TicketFilters,
  TicketSummary,
  WellBreakdown,
  UploadStatus,
} from "./ticket-types";

// Initialize OPs Inventory tables
export async function initOpsInventoryTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS oil_ticket_uploads (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(500) NOT NULL,
        file_url TEXT NOT NULL,
        file_key VARCHAR(500) UNIQUE NOT NULL,
        file_size INTEGER NOT NULL,
        upload_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        uploaded_by VARCHAR(255)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_status ON oil_ticket_uploads(status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_date ON oil_ticket_uploads(upload_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS oil_tickets (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER REFERENCES oil_ticket_uploads(id),
        bol_number VARCHAR(20),
        ticket_number VARCHAR(20) UNIQUE,
        trucking_company VARCHAR(255),
        shipper_name VARCHAR(255),
        shipper_time VARCHAR(50),
        shipper_account VARCHAR(100),
        operator VARCHAR(255),
        property_number VARCHAR(100),
        legal_land_desc VARCHAR(500),
        federal_lease_number VARCHAR(100),
        shipper_city VARCHAR(255),
        shipper_county VARCHAR(255),
        shipper_state VARCHAR(10),
        shipper_lat DECIMAL(10,6),
        shipper_lon DECIMAL(10,6),
        receiver_name VARCHAR(255),
        receiver_time VARCHAR(50),
        receiver_account VARCHAR(100),
        receiver_city VARCHAR(255),
        receiver_county VARCHAR(255),
        receiver_state VARCHAR(10),
        receiver_lat DECIMAL(10,6),
        receiver_lon DECIMAL(10,6),
        tank_id VARCHAR(50),
        tank_bbls_per_inch DECIMAL(10,4),
        tank_height DECIMAL(10,4),
        tank_volume DECIMAL(10,4),
        header_number VARCHAR(50),
        start_meter_1 DECIMAL(12,4),
        stop_meter_1 DECIMAL(12,4),
        start_meter_2 DECIMAL(12,4),
        stop_meter_2 DECIMAL(12,4),
        seal_off VARCHAR(50),
        seal_on VARCHAR(50),
        time_off VARCHAR(50),
        time_on VARCHAR(50),
        obs_gravity DECIMAL(8,4),
        obs_temp DECIMAL(8,4),
        start_temp DECIMAL(8,4),
        stop_temp DECIMAL(8,4),
        bsw_percent DECIMAL(8,4),
        avg_line_temp DECIMAL(8,4),
        meter_factor DECIMAL(10,6),
        loaded_barrels DECIMAL(10,4),
        net_barrels DECIMAL(10,4),
        delivered_bbls DECIMAL(10,4),
        corrected_gravity DECIMAL(8,4),
        driver_name VARCHAR(255),
        truck_number VARCHAR(50),
        trailer_number VARCHAR(50),
        standard_distance DECIMAL(10,2),
        loaded_miles DECIMAL(10,2),
        rerouted_miles DECIMAL(10,2),
        road_restrictions TEXT,
        notes TEXT,
        driver_notes TEXT,
        po_number VARCHAR(100),
        extraction_confidence DECIMAL(5,2),
        manually_corrected BOOLEAN DEFAULT FALSE,
        ticket_date DATE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_date ON oil_tickets(ticket_date DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_shipper ON oil_tickets(shipper_name);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_operator ON oil_tickets(operator);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_county ON oil_tickets(shipper_county);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_state ON oil_tickets(shipper_state);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_upload ON oil_tickets(upload_id);
    `);

    console.log("OPs Inventory tables initialized successfully");
  } finally {
    client.release();
  }
}

// Upload record operations
export async function createUploadRecord(params: {
  filename: string;
  file_url: string;
  file_key: string;
  file_size: number;
  uploaded_by: string;
}): Promise<OilTicketUpload> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO oil_ticket_uploads (filename, file_url, file_key, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.filename, params.file_url, params.file_key, params.file_size, params.uploaded_by]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateUploadStatus(
  id: number,
  status: UploadStatus,
  errorMessage?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    const processedAt = status === "completed" || status === "failed" ? "CURRENT_TIMESTAMP" : "NULL";
    await client.query(
      `UPDATE oil_ticket_uploads
       SET status = $1, error_message = $2, processed_at = ${processedAt}
       WHERE id = $3`,
      [status, errorMessage ?? null, id]
    );
  } finally {
    client.release();
  }
}

export async function getUploads(statusFilter?: UploadStatus): Promise<ReadonlyArray<OilTicketUpload>> {
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await client.query(
      `SELECT * FROM oil_ticket_uploads ${where} ORDER BY upload_date DESC`
    , params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getUploadById(id: number): Promise<OilTicketUpload | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM oil_ticket_uploads WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

// Ticket operations
export async function createTicket(
  params: Record<string, unknown>
): Promise<OilTicket> {
  const client = await pool.connect();
  try {
    const fields = [
      "upload_id", "bol_number", "ticket_number", "trucking_company",
      "shipper_name", "shipper_time", "shipper_account", "operator",
      "property_number", "legal_land_desc", "federal_lease_number",
      "shipper_city", "shipper_county", "shipper_state", "shipper_lat", "shipper_lon",
      "receiver_name", "receiver_time", "receiver_account",
      "receiver_city", "receiver_county", "receiver_state", "receiver_lat", "receiver_lon",
      "tank_id", "tank_bbls_per_inch", "tank_height", "tank_volume",
      "header_number", "start_meter_1", "stop_meter_1", "start_meter_2", "stop_meter_2",
      "seal_off", "seal_on", "time_off", "time_on",
      "obs_gravity", "obs_temp", "start_temp", "stop_temp", "bsw_percent",
      "avg_line_temp", "meter_factor",
      "loaded_barrels", "net_barrels", "delivered_bbls", "corrected_gravity",
      "driver_name", "truck_number", "trailer_number",
      "standard_distance", "loaded_miles", "rerouted_miles",
      "road_restrictions", "notes", "driver_notes", "po_number",
      "extraction_confidence", "manually_corrected", "ticket_date",
    ];

    const values = fields.map((f) => params[f] ?? null);
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    const updateSet = fields
      .filter((f) => f !== "ticket_number")
      .map((f) => `${f} = EXCLUDED.${f}`)
      .join(", ");

    const result = await client.query(
      `INSERT INTO oil_tickets (${fields.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (ticket_number) DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      values
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getTickets(filters: TicketFilters = {}): Promise<{
  tickets: ReadonlyArray<OilTicket>;
  total: number;
}> {
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`ticket_date >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`ticket_date <= $${params.length}`);
    }
    if (filters.shipper) {
      params.push(filters.shipper);
      conditions.push(`shipper_name = $${params.length}`);
    }
    if (filters.operator) {
      params.push(filters.operator);
      conditions.push(`operator = $${params.length}`);
    }
    if (filters.county) {
      params.push(filters.county);
      conditions.push(`shipper_county = $${params.length}`);
    }
    if (filters.state) {
      params.push(filters.state);
      conditions.push(`shipper_state = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(ticket_number ILIKE $${params.length} OR bol_number ILIKE $${params.length} OR shipper_name ILIKE $${params.length} OR driver_name ILIKE $${params.length})`
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `SELECT COUNT(*) FROM oil_tickets ${where}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await client.query(
      `SELECT t.*, u.file_url
       FROM oil_tickets t
       LEFT JOIN oil_ticket_uploads u ON t.upload_id = u.id
       ${where}
       ORDER BY t.ticket_date DESC, t.id DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return {
      tickets: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  } finally {
    client.release();
  }
}

export async function getTicketById(id: number): Promise<OilTicket | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT t.*, u.file_url
       FROM oil_tickets t
       LEFT JOIN oil_ticket_uploads u ON t.upload_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function updateTicket(
  id: number,
  fields: Record<string, unknown>
): Promise<OilTicket | null> {
  const client = await pool.connect();
  try {
    const allowedFields = [
      "bol_number", "ticket_number", "trucking_company",
      "shipper_name", "shipper_time", "shipper_account", "operator",
      "property_number", "legal_land_desc", "federal_lease_number",
      "shipper_city", "shipper_county", "shipper_state", "shipper_lat", "shipper_lon",
      "receiver_name", "receiver_time", "receiver_account",
      "receiver_city", "receiver_county", "receiver_state", "receiver_lat", "receiver_lon",
      "tank_id", "tank_bbls_per_inch", "tank_height", "tank_volume",
      "header_number", "start_meter_1", "stop_meter_1", "start_meter_2", "stop_meter_2",
      "seal_off", "seal_on", "time_off", "time_on",
      "obs_gravity", "obs_temp", "start_temp", "stop_temp", "bsw_percent",
      "avg_line_temp", "meter_factor",
      "loaded_barrels", "net_barrels", "delivered_bbls", "corrected_gravity",
      "driver_name", "truck_number", "trailer_number",
      "standard_distance", "loaded_miles", "rerouted_miles",
      "road_restrictions", "notes", "driver_notes", "po_number",
      "extraction_confidence", "manually_corrected", "ticket_date",
    ];

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        params.push(value);
        updates.push(`${key} = $${params.length}`);
      }
    }

    if (updates.length === 0) return null;

    params.push(id);
    const result = await client.query(
      `UPDATE oil_tickets SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function getTicketSummary(month?: string): Promise<TicketSummary> {
  const client = await pool.connect();
  try {
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    // Aggregate totals
    const totalsResult = await client.query(
      `SELECT
         COUNT(*) as total_tickets,
         COALESCE(SUM(loaded_barrels), 0) as total_loaded_bbls,
         COALESCE(SUM(net_barrels), 0) as total_net_bbls,
         COALESCE(SUM(delivered_bbls), 0) as total_delivered_bbls,
         AVG(obs_gravity) as avg_gravity,
         AVG(bsw_percent) as avg_bsw
       FROM oil_tickets
       WHERE TO_CHAR(ticket_date, 'YYYY-MM') = $1`,
      [targetMonth]
    );

    // Per-well breakdown
    const wellsResult = await client.query(
      `SELECT
         shipper_name,
         operator,
         shipper_county as county,
         shipper_state as state,
         COUNT(*) as ticket_count,
         COALESCE(SUM(loaded_barrels), 0) as loaded_bbls,
         COALESCE(SUM(net_barrels), 0) as net_bbls,
         COALESCE(SUM(delivered_bbls), 0) as delivered_bbls
       FROM oil_tickets
       WHERE TO_CHAR(ticket_date, 'YYYY-MM') = $1
       GROUP BY shipper_name, operator, shipper_county, shipper_state
       ORDER BY loaded_bbls DESC`,
      [targetMonth]
    );

    const totals = totalsResult.rows[0];
    const wells: WellBreakdown[] = wellsResult.rows.map((row) => ({
      shipper_name: row.shipper_name ?? "Unknown",
      operator: row.operator,
      county: row.county,
      state: row.state,
      ticket_count: parseInt(row.ticket_count, 10),
      loaded_bbls: parseFloat(row.loaded_bbls),
      net_bbls: parseFloat(row.net_bbls),
      delivered_bbls: parseFloat(row.delivered_bbls),
    }));

    return {
      month: targetMonth,
      total_tickets: parseInt(totals.total_tickets, 10),
      total_loaded_bbls: parseFloat(totals.total_loaded_bbls),
      total_net_bbls: parseFloat(totals.total_net_bbls),
      total_delivered_bbls: parseFloat(totals.total_delivered_bbls),
      avg_gravity: totals.avg_gravity ? parseFloat(totals.avg_gravity) : null,
      avg_bsw: totals.avg_bsw ? parseFloat(totals.avg_bsw) : null,
      wells,
    };
  } finally {
    client.release();
  }
}

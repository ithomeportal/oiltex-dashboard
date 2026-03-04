import pool from "./db";

export interface ArgusReport {
  id: number;
  report_date: string;
  report_type: string;
  subject: string | null;
  filename: string;
  file_url: string;
  file_key: string;
  file_size: number | null;
  fetched_at: string;
}

export interface CreateArgusReportData {
  report_date: string;
  report_type?: string;
  subject?: string;
  filename: string;
  file_url: string;
  file_key: string;
  file_size?: number;
}

export async function getArgusReports(
  limit: number = 20,
  offset: number = 0
): Promise<ArgusReport[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM argus_reports ORDER BY report_date DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getArgusReportByDate(
  date: string
): Promise<ArgusReport | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM argus_reports WHERE report_date = $1 LIMIT 1`,
      [date]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createArgusReport(
  data: CreateArgusReportData
): Promise<ArgusReport> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO argus_reports (report_date, report_type, subject, filename, file_url, file_key, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (report_date, report_type) DO NOTHING
       RETURNING *`,
      [
        data.report_date,
        data.report_type || "Americas Crude",
        data.subject || null,
        data.filename,
        data.file_url,
        data.file_key,
        data.file_size || null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getArgusReportCount(): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM argus_reports`
    );
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

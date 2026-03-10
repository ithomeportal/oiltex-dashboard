import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "30");
  const job = searchParams.get("job");

  const result = await pool.query(
    `SELECT id, job_name, status, message, details, started_at, completed_at
     FROM cron_logs
     ${job ? "WHERE job_name = $2" : ""}
     ORDER BY started_at DESC
     LIMIT $1`,
    job ? [limit, job] : [limit]
  );

  return NextResponse.json({ logs: result.rows });
}

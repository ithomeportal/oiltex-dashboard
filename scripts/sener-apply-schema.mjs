// Apply scripts/sener-schema.sql with the privileged credentials in .env.local.
// Usage: node --env-file=.env.local scripts/sener-apply-schema.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const sql = readFileSync(new URL("./sener-schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 10261),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const roles = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'oiltex_rw'");
  if (roles.rowCount === 0) throw new Error("runtime role oiltex_rw does not exist — refusing to continue");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const { rows } = await client.query(
    `SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
       FROM information_schema.role_table_grants
      WHERE grantee = 'oiltex_rw' AND table_name LIKE 'sener_%'
      GROUP BY table_name ORDER BY table_name`
  );
  console.log("schema applied; oiltex_rw grants:", rows);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("schema apply failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

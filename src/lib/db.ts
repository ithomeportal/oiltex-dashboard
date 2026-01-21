import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "10261"),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;

// Initialize database tables
export async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create oil_prices table for storing daily price data
    await client.query(`
      CREATE TABLE IF NOT EXISTS oil_prices (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        source VARCHAR(50) NOT NULL,
        price_type VARCHAR(100) NOT NULL,
        value DECIMAL(10, 4),
        unit VARCHAR(20) DEFAULT '$/BBL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, source, price_type)
      );
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oil_prices_date ON oil_prices(date DESC);
    `);

    // Create auth_codes table for email authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(8) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Fix code column length if it was created with wrong size
    await client.query(`
      ALTER TABLE auth_codes ALTER COLUMN code TYPE VARCHAR(8);
    `);

    // Fix expires_at column to use TIMESTAMPTZ for proper timezone handling
    await client.query(`
      ALTER TABLE auth_codes ALTER COLUMN expires_at TYPE TIMESTAMPTZ;
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add email column if it doesn't exist (migration for existing tables)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sessions' AND column_name = 'email'
        ) THEN
          ALTER TABLE sessions ADD COLUMN email VARCHAR(255);
        END IF;
      END $$;
    `);

    // Create price_calculations table for storing computed values like CMA
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_calculations (
        id SERIAL PRIMARY KEY,
        month VARCHAR(7) NOT NULL,
        calculation_type VARCHAR(100) NOT NULL,
        value DECIMAL(10, 4),
        source VARCHAR(50),
        trading_days INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month, calculation_type, source)
      );
    `);

    console.log("Database tables initialized successfully");
  } finally {
    client.release();
  }
}

// Helper function to save price data
export async function savePrice(
  date: string,
  source: string,
  priceType: string,
  value: number | null,
  unit: string = "$/BBL"
) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO oil_prices (date, source, price_type, value, unit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date, source, price_type)
       DO UPDATE SET value = $4, unit = $5`,
      [date, source, priceType, value, unit]
    );
  } finally {
    client.release();
  }
}

// Get latest prices
export async function getLatestPrices(days: number = 30) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT date, source, price_type, value, unit
       FROM oil_prices
       WHERE date >= CURRENT_DATE - $1
       ORDER BY date DESC, source, price_type`,
      [days]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Calculate and save CMA (Calendar Month Average)
export async function calculateCMA(month: string, source: string) {
  const client = await pool.connect();
  try {
    // month format: 'YYYY-MM'
    const result = await client.query(
      `SELECT
         AVG(value) as avg_value,
         COUNT(*) as trading_days
       FROM oil_prices
       WHERE TO_CHAR(date, 'YYYY-MM') = $1
         AND source = $2
         AND value IS NOT NULL`,
      [month, source]
    );

    if (result.rows[0].avg_value) {
      await client.query(
        `INSERT INTO price_calculations (month, calculation_type, value, source, trading_days)
         VALUES ($1, 'CMA', $2, $3, $4)
         ON CONFLICT (month, calculation_type, source)
         DO UPDATE SET value = $2, trading_days = $4, updated_at = CURRENT_TIMESTAMP`,
        [month, result.rows[0].avg_value, source, result.rows[0].trading_days]
      );
    }

    return {
      month,
      source,
      cma: result.rows[0].avg_value,
      tradingDays: result.rows[0].trading_days,
    };
  } finally {
    client.release();
  }
}

// Calculate CMA for all calendar days (including weekends/holidays with fill-forward logic)
export async function calculateCMAAllDays(month: string, source: string) {
  const client = await pool.connect();
  try {
    // month format: 'YYYY-MM'
    const [year, monthNum] = month.split("-").map(Number);

    // Get the number of calendar days in the month
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Get all trading day prices for this month, ordered by date
    const result = await client.query(
      `SELECT date, value
       FROM oil_prices
       WHERE TO_CHAR(date, 'YYYY-MM') = $1
         AND source = $2
         AND value IS NOT NULL
       ORDER BY date ASC`,
      [month, source]
    );

    // Also get the last trading day price from the previous month for fill-forward
    const prevMonthResult = await client.query(
      `SELECT value
       FROM oil_prices
       WHERE date < $1
         AND source = $2
         AND value IS NOT NULL
       ORDER BY date DESC
       LIMIT 1`,
      [`${year}-${String(monthNum).padStart(2, "0")}-01`, source]
    );

    // Create a map of trading day prices
    const tradingDayPrices: Map<string, number> = new Map();
    for (const row of result.rows) {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      tradingDayPrices.set(dateStr, parseFloat(row.value));
    }

    // Get the previous month's last price for fill-forward
    let lastKnownPrice: number | null =
      prevMonthResult.rows.length > 0
        ? parseFloat(prevMonthResult.rows[0].value)
        : null;

    // Build array of all calendar days with fill-forward logic
    const allDayPrices: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      if (tradingDayPrices.has(dateStr)) {
        // Trading day - use actual price
        lastKnownPrice = tradingDayPrices.get(dateStr)!;
        allDayPrices.push(lastKnownPrice);
      } else if (lastKnownPrice !== null) {
        // Non-trading day (weekend/holiday) - use fill-forward price
        allDayPrices.push(lastKnownPrice);
      }
      // If no previous price is available, skip this day
    }

    // Calculate the average
    const calendarDays = allDayPrices.length;
    const cmaAllDays =
      calendarDays > 0
        ? allDayPrices.reduce((sum, price) => sum + price, 0) / calendarDays
        : null;

    return {
      month,
      source,
      cmaAllDays,
      calendarDays,
    };
  } finally {
    client.release();
  }
}

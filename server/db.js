import pg from "pg";
const { Pool } = pg;

// Use postgresql connection string from environment variable or default local connection
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/maid_cafe";

export const pool = new Pool({
  connectionString,
});

export async function initDb() {
  console.log("[Database] Initializing PostgreSQL schemas...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Table: rooms
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        phase VARCHAR(50) NOT NULL DEFAULT 'WAITING',
        created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Table: guest_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS guest_users (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        session_token VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_online BOOLEAN NOT NULL DEFAULT FALSE,
        last_seen TIMESTAMPTZ,
        created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Table: menu_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        category VARCHAR(100) NOT NULL DEFAULT 'food',
        description TEXT,
        image_url TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_guest_users_room_id ON guest_users(room_id);
      CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token);
      CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(order_index);
    `);

    await client.query("COMMIT");
    console.log("[Database] PostgreSQL schemas initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Database] Failed to initialize PostgreSQL schema:", error);
    throw error;
  } finally {
    client.release();
  }
}

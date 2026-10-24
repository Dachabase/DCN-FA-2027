require('dotenv').config();
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}
const pool = new Pool({ connectionString });


async function run() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Existing tables in DB:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));
  } catch (err) {
    console.error('Error querying tables:', err.message);
  } finally {
    await pool.end();
  }
}

run();

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers?sslmode=no-verify',
});

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

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers",
});

async function main() {
  console.log("Checking DB connection via pg pool...");
  const client = await pool.connect();
  const res = await client.query("SELECT 1 as num");
  console.log("pg Pool connected successfully:", res.rows);
  client.release();
  await pool.end();
}

main().catch((err) => {
  console.error("Test failed:", err);
});

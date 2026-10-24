import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required to run test_seed.ts");
}
const pool = new Pool({ connectionString });


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

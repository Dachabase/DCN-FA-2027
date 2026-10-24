require('dotenv').config();
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}
const pool = new Pool({ connectionString });


async function main() {
  const tables = ['Faculty', 'Department', 'Course', 'DepartmentCourse', 'Resource', 'Question', 'QuizAttempt', 'UtmeQuestion'];
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`${t}: ${res.rows[0].count}`);
    } catch (e) {
      console.log(`${t}: error - ${e.message}`);
    }
  }
  await pool.end();
}
main();

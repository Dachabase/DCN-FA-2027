const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers?sslmode=no-verify',
});

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

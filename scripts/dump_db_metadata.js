require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}
const pool = new Pool({ connectionString });


async function dump() {
  const coursesRes = await pool.query('SELECT * FROM "Course" ORDER BY code');
  fs.writeFileSync('scratch/db_courses.json', JSON.stringify(coursesRes.rows, null, 2));
  console.log(`Dumped ${coursesRes.rows.length} DB courses to scratch/db_courses.json`);

  const facRes = await pool.query('SELECT * FROM "Faculty" ORDER BY name');
  fs.writeFileSync('scratch/db_faculties.json', JSON.stringify(facRes.rows, null, 2));
  console.log(`Dumped ${facRes.rows.length} DB faculties to scratch/db_faculties.json`);

  const deptRes = await pool.query('SELECT * FROM "Department" ORDER BY name');
  fs.writeFileSync('scratch/db_departments.json', JSON.stringify(deptRes.rows, null, 2));
  console.log(`Dumped ${deptRes.rows.length} DB departments to scratch/db_departments.json`);

  await pool.end();
}

dump().catch(console.error);

const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers?sslmode=no-verify' });

async function main() {
  const coursesRes = await pool.query('SELECT id, code, title, level, semester, status, units, "isUniversityWide" FROM "Course" ORDER BY code');
  console.log(`Total Courses in DB: ${coursesRes.rows.length}`);
  console.log('Sample courses in DB:');
  for (const c of coursesRes.rows.slice(0, 30)) {
    console.log(` - [${c.code}] ${c.title} (${c.semester} sem, ${c.units} units)`);
  }

  const facRes = await pool.query('SELECT id, name, code FROM "Faculty" ORDER BY name');
  console.log(`\nTotal Faculties in DB: ${facRes.rows.length}`);
  for (const f of facRes.rows) {
    console.log(` - [${f.id}] ${f.name} (code: ${f.code})`);
  }

  const resRes = await pool.query('SELECT id, title, type, category, url, "facultyId", "departmentId" FROM "Resource"');
  console.log(`\nTotal Resources in DB: ${resRes.rows.length}`);
  for (const r of resRes.rows) {
    console.log(` - [${r.type}] ${r.title} (cat: ${r.category}, url: ${r.url})`);
  }

  await pool.end();
}

main().catch(console.error);

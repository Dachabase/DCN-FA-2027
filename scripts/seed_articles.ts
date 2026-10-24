import "dotenv/config";
import { prisma } from "../src/database/prisma";
import { ALL_GUIDES } from "../src/data/guides-data";

async function seedArticles() {
  console.log(`🌱 Seeding ${ALL_GUIDES.length} platform guides and blog articles into PostgreSQL...`);
  
  const faculties = await prisma.faculty.findMany();
  const facMap: Record<string, string> = {};
  for (const f of faculties) {
    facMap[f.name.toLowerCase()] = f.id;
    if (f.code) facMap[f.code.toLowerCase()] = f.id;
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const g of ALL_GUIDES) {
    try {
      let validFacultyId: string | null = null;
      if (g.faculty && g.faculty.name && facMap[g.faculty.name.toLowerCase()]) {
        validFacultyId = facMap[g.faculty.name.toLowerCase()];
      } else if (g.facultyId && Object.values(facMap).includes(g.facultyId)) {
        validFacultyId = g.facultyId;
      }

      const existing = await prisma.guide.findUnique({
        where: { id: g.id }
      });

      if (!existing) {
        await prisma.guide.create({
          data: {
            id: g.id,
            title: g.title,
            summary: g.summary,
            content: g.content,
            category: g.category,
            status: g.status || "PUBLISHED",
            facultyId: validFacultyId,
            departmentId: null,
            seriesId: g.seriesId || null,
            seriesTitle: g.seriesTitle || null,
            seriesOrder: g.seriesOrder || null,
            seriesTotal: g.seriesTotal || null,
            source: g.source,
            owner: g.owner,
            verifiedDate: g.verifiedDate ? new Date(g.verifiedDate) : new Date(),
          }
        });
        createdCount++;
      } else {
        await prisma.guide.update({
          where: { id: g.id },
          data: {
            title: g.title,
            summary: g.summary,
            content: g.content,
            category: g.category,
            status: g.status || "PUBLISHED",
            facultyId: validFacultyId,
            source: g.source,
            owner: g.owner,
            verifiedDate: g.verifiedDate ? new Date(g.verifiedDate) : new Date(),
          }
        });
        updatedCount++;
      }
    } catch (err: any) {
      console.warn(`Warning upserting guide ${g.id}:`, err.message);
    }
  }

  const totalInDb = await prisma.guide.count();
  console.log(`✅ Database Seeding Complete!`);
  console.log(`   • Created: ${createdCount}`);
  console.log(`   • Updated: ${updatedCount}`);
  console.log(`   • Total Guides in Database: ${totalInDb} / ${ALL_GUIDES.length}`);
}

seedArticles()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

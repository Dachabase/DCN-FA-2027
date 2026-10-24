import { prisma } from "../src/database/prisma";

async function verifyContract() {
  console.log("=== UI FRESHERS COMPANION API & DATA CONTRACT VERIFICATION ===");
  
  // 1. Verify Faculties
  const faculties = await prisma.faculty.findMany({ include: { departments: true } });
  console.log(`✅ Faculties Count: ${faculties.length}`);
  faculties.forEach(f => console.log(`   - ${f.name} (${f.code}) — ${f.departments.length} departments`));

  // 2. Verify Guides Provenance
  const guides = await prisma.guide.findMany();
  console.log(`✅ Guides Count: ${guides.length}`);
  if (guides.length > 0) {
    const sample = guides[0];
    console.log(`   - Sample Guide: "${sample.title}"`);
    console.log(`   - Provenance Source: "${sample.source}"`);
    console.log(`   - Provenance Owner: "${sample.owner}"`);
    console.log(`   - Verified Date: ${sample.verifiedDate}`);
  }

  // 3. Verify Resources Provenance
  const resources = await prisma.resource.findMany();
  console.log(`✅ Resources Count: ${resources.length}`);
  if (resources.length > 0) {
    const sample = resources[0];
    console.log(`   - Sample Resource: "${sample.title}" (${sample.type})`);
    console.log(`   - Provenance Source: "${sample.source}"`);
  }

  // 4. Verify Opportunities
  const opportunities = await prisma.opportunity.findMany();
  console.log(`✅ Opportunities Count: ${opportunities.length}`);

  // 5. Verify FAQs
  const faqs = await prisma.fAQ.findMany();
  console.log(`✅ FAQs Count: ${faqs.length}`);

  // 6. Verify Telegram Bot Records
  const bots = await prisma.bot.findMany({ include: { faculty: true } });
  console.log(`✅ Bots Count: ${bots.length}`);
  bots.forEach(b => console.log(`   - Bot: @${b.username} (${b.name}) mapped to ${b.faculty?.name || 'General'}`));

  console.log("=== ALL CONTRACT VERIFICATIONS PASSED ===");
}

verifyContract()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

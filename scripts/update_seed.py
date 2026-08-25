import re

seed_path = "/Users/daviditoya/Downloads/SBAI4FA27/prisma/seed.ts"

with open(seed_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import if not present
if 'import { ALL_GUIDES }' not in content:
    content = 'import { ALL_GUIDES } from "../src/data/guides-data";\n' + content

# Replace the const allGuides = [...] block
old_guides_block = r'(\/\/ 6\. SEED ALL ESSENTIAL IN-APP GUIDES[\s\S]*?const allGuides = \[[\s\S]*?\n  \];\n\n  for \(const g of allGuides\) \{[\s\S]*?\}\n  \}\n\n  console\.log\(`✅ \$\{allGuides\.length\} In-App Academic & Clearance Guides seeded\.`\);)'

new_guides_block = """// 6. SEED ALL ESSENTIAL IN-APP GUIDES
  for (const g of ALL_GUIDES) {
    let resolvedFacultyId = g.facultyId;
    if (g.faculty && g.faculty.name && facultyMap[g.faculty.name]) {
      resolvedFacultyId = facultyMap[g.faculty.name].id;
    }

    await prisma.guide.upsert({
      where: { id: g.id },
      update: {
        title: g.title,
        summary: g.summary,
        content: g.content,
        category: g.category,
        status: g.status,
        facultyId: resolvedFacultyId,
        source: g.source,
        owner: g.owner,
        seriesId: g.seriesId || null,
        seriesTitle: g.seriesTitle || null,
        seriesOrder: g.seriesOrder || null,
        seriesTotal: g.seriesTotal || null,
      },
      create: {
        id: g.id,
        title: g.title,
        summary: g.summary,
        content: g.content,
        category: g.category,
        status: g.status,
        facultyId: resolvedFacultyId,
        source: g.source,
        owner: g.owner,
        seriesId: g.seriesId || null,
        seriesTitle: g.seriesTitle || null,
        seriesOrder: g.seriesOrder || null,
        seriesTotal: g.seriesTotal || null,
      },
    });
  }

  console.log(`✅ ${ALL_GUIDES.length} In-App Academic & Clearance Guides seeded.`);"""

if re.search(old_guides_block, content):
    content = re.sub(old_guides_block, new_guides_block, content)
    print("✅ Successfully updated prisma/seed.ts to use ALL_GUIDES")
else:
    print("⚠️ Pattern for allGuides block in seed.ts not matched")

with open(seed_path, "w", encoding="utf-8") as f:
    f.write(content)

seed_path = "/Users/daviditoya/Downloads/SBAI4FA27/prisma/seed.ts"

with open(seed_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "const allGuides = [" in line:
        start_idx = i
    if "console.log(`✅ ${allGuides.length} In-App Academic & Clearance Guides seeded.`);" in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    new_loop = """  for (const g of ALL_GUIDES) {
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

  console.log(`✅ ${ALL_GUIDES.length} In-App Academic & Clearance Guides seeded.`);\n"""

    new_lines = lines[:start_idx] + [new_loop] + lines[end_idx+1:]
    with open(seed_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("✅ Successfully updated prisma/seed.ts")
else:
    print(f"Indices not found: start={start_idx}, end={end_idx}")

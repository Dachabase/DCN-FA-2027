import { prisma } from "../src/database/prisma";

async function main() {
  console.log("🔧 Fixing and Linking CHE 126 Course in Database...");

  // 1. Find Faculty of Science
  const scienceFaculty = await prisma.faculty.findFirst({
    where: {
      OR: [
        { code: "SCIENCE" },
        { name: { contains: "Science", mode: "insensitive" } },
      ],
    },
  });

  if (!scienceFaculty) {
    throw new Error("Science faculty not found");
  }

  // 2. Upsert CHE 126 Course
  const course = await prisma.course.upsert({
    where: { code: "CHE 126" },
    update: {
      title: "Introductory Chemistry Practical",
      level: 100,
      semester: "2nd",
      units: 2,
      facultyId: scienceFaculty.id,
      isUniversityWide: false,
    },
    create: {
      code: "CHE 126",
      title: "Introductory Chemistry Practical",
      level: 100,
      semester: "2nd",
      units: 2,
      facultyId: scienceFaculty.id,
      isUniversityWide: false,
    },
  });

  console.log(`✅ Course CHE 126 ensured: [${course.id}] ${course.code} - ${course.title}`);

  // 3. Link all Questions with courseCode "CHE 126" to this courseId
  const updatedQuestions = await prisma.question.updateMany({
    where: {
      courseCode: { in: ["CHE 126", "CHE126"] },
    },
    data: {
      courseId: course.id,
      courseTitle: "Introductory Chemistry Practical",
      facultyId: scienceFaculty.id,
    },
  });

  console.log(`✅ Linked ${updatedQuestions.count} questions to courseId ${course.id}`);

  // 4. Link all Resources with courseCode "CHE 126" to this courseId
  const updatedResources = await prisma.resource.updateMany({
    where: {
      courseCode: { in: ["CHE 126", "CHE126"] },
    },
    data: {
      courseId: course.id,
      facultyId: scienceFaculty.id,
    },
  });

  console.log(`✅ Linked ${updatedResources.count} vault materials to courseId ${course.id}`);

  // 5. Create default CourseTopic records if none exist
  const existingTopics = await prisma.courseTopic.findMany({
    where: { courseId: course.id },
  });

  if (existingTopics.length === 0) {
    const topics = [
      { name: "Qualitative Inorganic Analysis", freq: 85 },
      { name: "Volumetric Titrimetry & Acid-Base Reactions", freq: 95 },
      { name: "Redox & Precipitation Reactions", freq: 50 },
      { name: "Organic Functional Group Tests", freq: 43 },
    ];

    for (const t of topics) {
      await prisma.courseTopic.create({
        data: {
          course: { connect: { id: course.id } },
          name: t.name,
          historicalFrequency: t.freq,
          isHighYield: t.freq >= 50,
        },
      });
    }
    console.log(`✅ Created ${topics.length} CourseTopic records for CHE 126`);
  }

  // 6. Verify via academic100lService getCourses
  const courses = await prisma.course.findMany({
    where: { code: "CHE 126" },
    include: {
      _count: { select: { questions: true, resources: true, topics: true } },
    },
  });

  console.log("Verification summary:", courses);
}

main()
  .catch((err) => {
    console.error("❌ Link error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

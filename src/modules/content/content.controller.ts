import { Router, Request, Response } from "express";
import {
  listFaculties,
  listCourses,
  getCourseDetails,
  importContentPayload,
  parseQuestionsCsv,
} from "./content.service";
import { ContentImportPayloadSchema } from "./content.types";
import { optionalAuth } from "../../auth/auth.middleware";

export const contentRouter = Router();

// GET /api/content/faculties - List faculties and departments
contentRouter.get("/faculties", async (req: Request, res: Response) => {
  try {
    const faculties = await listFaculties();
    res.json({ success: true, data: faculties });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/content/courses - List courses with filters
contentRouter.get("/courses", async (req: Request, res: Response) => {
  try {
    const { facultyId, departmentId, level, semester, isUniversityWide } = req.query;

    const courses = await listCourses({
      facultyId: facultyId ? String(facultyId) : undefined,
      departmentId: departmentId ? String(departmentId) : undefined,
      level: level ? parseInt(String(level)) : undefined,
      semester: semester ? String(semester) : undefined,
      isUniversityWide: isUniversityWide !== undefined ? isUniversityWide === "true" : undefined,
    });

    res.json({ success: true, data: courses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/content/courses/:courseId - Get course details, syllabus topics, and past papers
contentRouter.get("/courses/:courseId", async (req: Request, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const course = await getCourseDetails(courseId);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, data: course });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/content/import - Ingestion endpoint for structured question banks
contentRouter.post("/import", async (req: Request, res: Response) => {
  try {
    const parseResult = ContentImportPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid import payload",
        errors: parseResult.error.flatten(),
      });
    }

    const result = await importContentPayload(parseResult.data);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/content/import-csv - Ingest CSV questions text
contentRouter.post("/import-csv", async (req: Request, res: Response) => {
  try {
    const { csvContent, courseCode, courseTitle, sessionYear } = req.body;
    if (!csvContent || !courseCode) {
      return res.status(400).json({
        success: false,
        message: "csvContent and courseCode are required",
      });
    }

    const questions = parseQuestionsCsv(csvContent);
    const result = await importContentPayload({
      courseCode,
      courseTitle: courseTitle || courseCode,
      examPaper: sessionYear ? {
        title: `${courseCode} ${sessionYear} CBT`,
        sessionYear,
        durationMin: 60,
        totalMarks: 50,
        sourceType: "GES_CBT_TEST",
      } : undefined,
      questions,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

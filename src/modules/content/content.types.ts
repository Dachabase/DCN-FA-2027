import { z } from "zod";

export const QuestionImportItemSchema = z.object({
  courseCode: z.string().min(2),
  courseTitle: z.string().optional(),
  topicName: z.string().min(2),
  format: z.enum(["SBA", "MCQ_TF", "SHORT_ANSWER", "ESSAY"]).default("SBA"),
  stem: z.string().min(5),
  options: z.array(z.string()).min(2), // e.g. ["A) Option 1", "B) Option 2", ...]
  correctAnswer: z.string().min(1),   // e.g. "A" or "True" or "B"
  explanation: z.string().min(5),     // Worked step-by-step reasoning
  distractorNotes: z.record(z.string(), z.string()).optional(), // e.g. { "A": "Why A is wrong", ... }
  limbRationales: z.record(z.string(), z.string()).optional(),  // for True/False limbs
  referenceSource: z.string().optional(), // Textbook or lecture note citation
  examYear: z.number().int().optional(),
  academicSession: z.string().optional(),  // e.g. "2023/2024"
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

export const ContentImportPayloadSchema = z.object({
  courseCode: z.string().min(2),
  courseTitle: z.string().min(3),
  facultyCode: z.string().optional(),
  departmentName: z.string().optional(),
  level: z.number().int().default(100),
  semester: z.string().default("1st"),
  isUniversityWide: z.boolean().default(false),
  examPaper: z.object({
    title: z.string(),
    sessionYear: z.string(),
    durationMin: z.number().int().optional().default(60),
    totalMarks: z.number().int().optional().default(50),
    sourceType: z.string().optional().default("GES_CBT_TEST"),
  }).optional(),
  questions: z.array(QuestionImportItemSchema),
});

export type QuestionImportItem = z.input<typeof QuestionImportItemSchema>;
export type ContentImportPayload = z.input<typeof ContentImportPayloadSchema>;

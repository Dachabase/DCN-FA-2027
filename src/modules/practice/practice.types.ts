import { z } from "zod";

export const PracticeModeEnum = z.enum([
  "PRACTICE", // Instant answers, distractor notes, untimed
  "EXAM",     // CBT Hall simulation, timed, navigation grid, delayed feedback
  "REVISION", // Rapid drill mode
  "TOPIC",    // Filtered by specific syllabus topics
]);

export const ConfidenceRatingEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const StartPracticeSessionSchema = z.object({
  courseCode: z.string().optional(),
  courseId: z.string().optional(),
  mode: PracticeModeEnum.default("PRACTICE"),
  topicIds: z.array(z.string()).optional(),
  format: z.enum(["SBA", "MCQ_TF", "ALL"]).default("ALL"),
  questionCount: z.number().int().min(1).max(100).default(20),
  timeAllowedMinutes: z.number().int().min(1).max(180).optional(),
  examPaperId: z.string().optional(),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string(),
  userAnswer: z.string().min(1), // e.g. "A" or "T, F, T, T"
  confidenceRating: ConfidenceRatingEnum.default("MEDIUM"),
  timeSpentSeconds: z.number().int().min(0).default(0),
});

export const CompleteSessionSchema = z.object({
  forceTimedOut: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export type PracticeMode = z.infer<typeof PracticeModeEnum>;
export type ConfidenceRating = z.infer<typeof ConfidenceRatingEnum>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type CompleteSessionInput = z.infer<typeof CompleteSessionSchema>;

export interface QuestionSessionPayload {
  id: string;
  courseCode: string;
  courseTitle: string;
  topic: string;
  type: string;
  questionText: string;
  options: string[];
  hasImage: boolean;
  imageUrl?: string | null;
  difficulty: string | null;
  // Included in instant practice mode:
  correctAnswer?: string;
  explanation?: string;
  distractorNotes?: any;
  limbRationales?: any;
}

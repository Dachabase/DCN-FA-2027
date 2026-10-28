import { z } from "zod";

export const CreateLessonSchema = z.object({
  courseCode: z.string().min(2),
  topicName: z.string().min(2),
  title: z.string().min(3),
  summary: z.string().optional(),
  content: z.string().min(20),
  readTimeMin: z.number().int().min(1).optional(),
  orderIndex: z.number().int().default(0),
  checkQIds: z.array(z.string()).optional(),
});

export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

export interface LessonSummaryItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  topicId: string;
  topicName: string;
  title: string;
  summary: string | null;
  readTimeMin: number;
  orderIndex: number;
  checkQuestionsCount: number;
  isCompleted: boolean;
}

export interface LessonDetailResponse {
  id: string;
  course: {
    id: string;
    code: string;
    title: string;
  };
  topic: {
    id: string;
    name: string;
    isHighYield: boolean;
    historicalFrequency: number;
  };
  title: string;
  summary: string | null;
  content: string;
  readTimeMin: number;
  orderIndex: number;
  isCompleted: boolean;
  checkQuestions: {
    id: string;
    stem: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    type: string;
    difficulty: string | null;
  }[];
  practiceDrillUrl: string;
}


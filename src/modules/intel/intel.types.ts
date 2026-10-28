export type TopicYieldStatus = "CRITICAL_WEAK_AREA" | "NEEDS_PRACTICE" | "MASTERED" | "UNATTEMPTED";

export interface TopicIntelItem {
  topicId: string;
  topicName: string;
  isHighYield: boolean;
  questionCount: number;
  historicalFrequency: number;
  examAppearanceLikelihood: number; // 0 to 100 percentage
  difficultyBreakdown: {
    easyCount: number;
    mediumCount: number;
    hardCount: number;
  };
  studentPerformance?: {
    attemptedCount: number;
    correctCount: number;
    accuracyPercentage: number;
    status: TopicYieldStatus;
    dueForSpacedReview: boolean;
  };
}

export interface CourseExamIntelResponse {
  course: {
    id: string;
    code: string;
    title: string;
    level: number;
    semester: string;
    isUniversityWide: boolean;
    facultyName?: string;
  };
  summary: {
    totalQuestions: number;
    totalTopics: number;
    totalPastPapers: number;
    highYieldTopicCount: number;
  };
  heroTopics: TopicIntelItem[];
  allTopics: TopicIntelItem[];
  criticalWeakAreas: TopicIntelItem[];
}

export interface FacultyExamIntelResponse {
  faculty: {
    id: string;
    name: string;
    code: string | null;
  };
  summary: {
    totalCourses: number;
    totalQuestions: number;
    totalExamPapers: number;
  };
  topTestedCourses: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    questionCount: number;
    highYieldTopicCount: number;
  }[];
  highYieldTopicsAcrossFaculty: {
    courseCode: string;
    topicName: string;
    questionCount: number;
    appearanceLikelihood: number;
  }[];
}

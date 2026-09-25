export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIKnowledge {
  chunkId: string;

  content: string;

  heading: string | null;

  pageNumber: number | null;

  slideNumber: number | null;

  source: {
    id: string;

    title: string;

    description: string | null;

    type: string;

    authority: string;

    fileName: string | null;

    sourceUrl: string | null;

    departmentId: string | null;

    courseCode: string | null;

    courseName: string | null;

    level: number | null;

    version: string | null;

    publishedAt: Date | null;

    expiresAt: Date | null;
  };

  score: number;
}

export interface AIContext {
  user: {
    firstName: string | null;

    lastName: string | null;

    username: string | null;

    faculty: string | null;

    department: string | null;

    level: number | null;
  };

  memories: Array<{
    type: string;

    content: string;

    importance: number;

    confidence: number;
  }>;

  /**
   * Relevant knowledge retrieved from the faculty
   * knowledge base for the student's current question.
   *
   * This is deliberately selective.
   *
   * We do NOT send the entire faculty knowledge base
   * to the AI model.
   */
  knowledge: AIKnowledge[];

  /**
   * Previous conversation messages.
   *
   * The current user message is deliberately kept separate
   * in `currentMessage` so we can determine whether this is
   * the first message in the conversation.
   */
  messages: AIMessage[];

  /**
   * The message currently being answered.
   */
  currentMessage: string;

  /**
   * True only when there are no previous messages in the
   * conversation before the current message.
   */
  isFirstMessage: boolean;
}

export interface AIProvider {
  generateResponse(
    context: AIContext
  ): Promise<string>;
}
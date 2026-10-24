export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
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

  messages: AIMessage[];
}

export interface AIProvider {
  generateResponse(
    context: AIContext
  ): Promise<string>;
}
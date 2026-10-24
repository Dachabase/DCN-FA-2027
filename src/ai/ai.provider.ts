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

<<<<<<< HEAD
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
=======
  messages: AIMessage[];
>>>>>>> 6e2e38577695a97901aa20f7c0e064e5b40aafa2
}

export interface AIProvider {
  generateResponse(
    context: AIContext
  ): Promise<string>;
}
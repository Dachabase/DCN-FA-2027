import type {
  AIProvider,
} from "./ai.provider";

import {
  MockAIProvider,
} from "./mock.provider";

import {
  buildAIContext,
} from "./context.builder";

import {
  saveAssistantMessage,
  saveUserMessage,
} from "../conversations/message.service";

export class AIService {
  constructor(
    private readonly provider: AIProvider
  ) {}

  async respond(
    userId: string,
    conversationId: string,
    message: string
  ) {
    // ---------------------------------------------------
    // Save user's message
    // ---------------------------------------------------

    await saveUserMessage(
      conversationId,
      message
    );

    // ---------------------------------------------------
    // Build context
    // ---------------------------------------------------

    const context =
      await buildAIContext(
        userId,
        conversationId
      );

    // ---------------------------------------------------
    // Ask AI provider
    // ---------------------------------------------------

    const response =
      await this.provider.generateResponse(
        context
      );

    // ---------------------------------------------------
    // Save AI response
    // ---------------------------------------------------

    await saveAssistantMessage(
      conversationId,
      response
    );

    return response;
  }
}

// -------------------------------------------------------
// Default AI service
// -------------------------------------------------------

export const aiService =
  new AIService(
    new MockAIProvider()
  );
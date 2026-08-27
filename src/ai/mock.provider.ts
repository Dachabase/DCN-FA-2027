import type {
  AIContext,
  AIProvider,
} from "./ai.provider";

export class MockAIProvider
  implements AIProvider
{
  async generateResponse(
    context: AIContext
  ): Promise<string> {
    const firstName =
      context.user.firstName ??
      "there";

    const department =
      context.user.department ??
      "your department";

    const lastMessage =
      context.messages[
        context.messages.length - 1
      ]?.content ?? "";

    return (
      `Hey ${firstName}!\n\n` +
      `I received your message:\n` +
      `"${lastMessage}"\n\n` +
      `I know you're studying ${department}. ` +
      `The real AI study buddy will be connected here next. 🤖`
    );
  }
}
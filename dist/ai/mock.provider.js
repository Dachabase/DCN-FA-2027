"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAIProvider = void 0;
class MockAIProvider {
    async generateResponse(context) {
        const firstName = context.user.firstName ??
            "there";
        const department = context.user.department ??
            "your department";
        const lastMessage = context.messages[context.messages.length - 1]?.content ?? "";
        return (`Hey ${firstName}!\n\n` +
            `I received your message:\n` +
            `"${lastMessage}"\n\n` +
            `I know you're studying ${department}. ` +
            `The real AI study buddy will be connected here next. 🤖`);
    }
}
exports.MockAIProvider = MockAIProvider;
